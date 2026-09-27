package domain

import (
	"context"
	"errors"
	"time"
)

// Invariants from the requirements; the storm doesn't state them.
var (
	ErrJobAlreadyPublished = errors.New("job is already published")
	ErrJobHasNoTitle       = errors.New("job needs a title before it can be published")
)

// Job is an aggregate root. It handles Publish Job and records Job Published.
type Job struct {
	id             string
	organizationID string
	title          string
	publishedAt    time.Time
	events         []DomainEvent
}

func NewJob(id, organizationID, title string) *Job {
	return &Job{id: id, organizationID: organizationID, title: title}
}

func (j *Job) ID() string { return j.id }

func (j *Job) Published() bool { return !j.publishedAt.IsZero() }

// Publish handles the Publish Job command.
func (j *Job) Publish(by string, at time.Time) error {
	if j.Published() {
		return ErrJobAlreadyPublished
	}
	if j.title == "" {
		return ErrJobHasNoTitle
	}
	j.publishedAt = at
	j.events = append(j.events, JobPublished{
		JobID:          j.id,
		OrganizationID: j.organizationID,
		PublishedBy:    by,
		PublishedAt:    at,
	})
	return nil
}

// PullEvents hands over the events recorded since the last pull.
func (j *Job) PullEvents() []DomainEvent {
	e := j.events
	j.events = nil
	return e
}

type JobRepository interface {
	Get(ctx context.Context, id string) (*Job, error)
	Save(ctx context.Context, j *Job) error
}

// JobPublished is recorded by Job when it is published.
type JobPublished struct {
	JobID          string
	OrganizationID string
	PublishedBy    string
	PublishedAt    time.Time
}

func (JobPublished) EventName() string { return "job_published" }
