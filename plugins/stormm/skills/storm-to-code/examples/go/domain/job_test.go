package domain

import (
	"errors"
	"testing"
	"time"
)

var now = time.Date(2026, 9, 27, 9, 0, 0, 0, time.UTC)

func TestPublishRecordsJobPublished(t *testing.T) {
	j := NewJob("j1", "org1", "Go developer")
	if err := j.Publish("alice", now); err != nil {
		t.Fatal(err)
	}
	want := JobPublished{JobID: "j1", OrganizationID: "org1", PublishedBy: "alice", PublishedAt: now}
	if got := j.PullEvents(); len(got) != 1 || got[0] != want {
		t.Fatalf("events = %+v, want [%+v]", got, want)
	}
}

func TestPublishRefuses(t *testing.T) {
	published := NewJob("j1", "org1", "Go developer")
	_ = published.Publish("alice", now)
	published.PullEvents()

	for name, tc := range map[string]struct {
		job  *Job
		want error
	}{
		"already published": {published, ErrJobAlreadyPublished},
		"no title":          {NewJob("j2", "org1", ""), ErrJobHasNoTitle},
	} {
		t.Run(name, func(t *testing.T) {
			if err := tc.job.Publish("bob", now); !errors.Is(err, tc.want) {
				t.Fatalf("err = %v, want %v", err, tc.want)
			}
			if e := tc.job.PullEvents(); len(e) != 0 {
				t.Fatalf("a refused command recorded %v", e)
			}
		})
	}
}
