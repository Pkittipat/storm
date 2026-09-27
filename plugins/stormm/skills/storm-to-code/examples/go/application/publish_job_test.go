package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"example.com/jobs/application/command"
	"example.com/jobs/application/eventbus"
	"example.com/jobs/application/policy"
	"example.com/jobs/application/query"
	"example.com/jobs/domain"
)

// The Publish Job slice, wired in memory: the command, the aggregate, and everything that reacts to Job Published.
func TestPublishJobSlice(t *testing.T) {
	ctx := context.Background()
	now := time.Date(2026, 9, 27, 9, 0, 0, 0, time.UTC)
	jobs := memJobs{"j1": domain.NewJob("j1", "org1", "Go developer")}
	details := memDetails{"j1": {JobID: "j1", Title: "Go developer", Status: "draft"}}
	var log []command.CreateActivityLog
	var notified []string

	bus := eventbus.New()
	eventbus.Subscribe(bus, policy.LogActivity{CreateActivityLog: command.CreateActivityLogHandler{Store: appendLog(&log)}}.Handle)
	eventbus.Subscribe(bus, policy.NotifyOrganizationMembers{NotifyMember: command.NotifyMemberHandler{Notifier: notifier(&notified)}}.Handle)
	eventbus.Subscribe(bus, query.JobDetailProjection{Store: details}.OnJobPublished)
	publish := command.PublishJobHandler{Jobs: jobs, Events: bus, Now: func() time.Time { return now }}

	if err := publish.Handle(ctx, command.PublishJob{JobID: "j1", RecruiterID: "alice"}); err != nil {
		t.Fatal(err)
	}
	if len(log) != 1 || log[0] != (command.CreateActivityLog{SubjectID: "j1", Action: "job_published", ActorID: "alice", At: now}) {
		t.Errorf("activity log = %+v", log)
	}
	if len(notified) != 1 || notified[0] != "org1/j1" {
		t.Errorf("notified = %v", notified)
	}
	if d := details["j1"]; d.Status != "published" || !d.PublishedAt.Equal(now) {
		t.Errorf("job detail = %+v", d)
	}

	err := publish.Handle(ctx, command.PublishJob{JobID: "j1", RecruiterID: "alice"})
	if !errors.Is(err, domain.ErrJobAlreadyPublished) {
		t.Fatalf("second publish: err = %v", err)
	}
	if len(log) != 1 || len(notified) != 1 {
		t.Error("a refused command must not trigger the policies")
	}
}

type memJobs map[string]*domain.Job

func (m memJobs) Get(_ context.Context, id string) (*domain.Job, error) { return m[id], nil }
func (m memJobs) Save(_ context.Context, j *domain.Job) error           { m[j.ID()] = j; return nil }

type memDetails map[string]query.JobDetail

func (m memDetails) Get(_ context.Context, id string) (query.JobDetail, error) { return m[id], nil }
func (m memDetails) Put(_ context.Context, d query.JobDetail) error            { m[d.JobID] = d; return nil }

type logStore struct{ entries *[]command.CreateActivityLog }

func (s logStore) Append(_ context.Context, e command.CreateActivityLog) error {
	*s.entries = append(*s.entries, e)
	return nil
}

func appendLog(into *[]command.CreateActivityLog) logStore { return logStore{into} }

type notifyFunc func(org, job string)

func (f notifyFunc) NotifyJobPublished(_ context.Context, org, job string) error {
	f(org, job)
	return nil
}

func notifier(into *[]string) notifyFunc {
	return func(org, job string) { *into = append(*into, org+"/"+job) }
}
