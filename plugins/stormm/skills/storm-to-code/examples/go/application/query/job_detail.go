package query

import (
	"context"
	"time"

	"example.com/jobs/domain"
)

// JobDetail is the view a Recruiter publishes a job from.
type JobDetail struct {
	JobID       string
	Title       string
	Status      string
	PublishedAt time.Time
}

type JobDetailStore interface {
	Get(ctx context.Context, jobID string) (JobDetail, error)
	Put(ctx context.Context, d JobDetail) error
}

// JobDetailProjection keeps JobDetail up to date from the events that update it.
type JobDetailProjection struct {
	Store JobDetailStore
}

func (p JobDetailProjection) OnJobPublished(ctx context.Context, e domain.JobPublished) error {
	d, err := p.Store.Get(ctx, e.JobID)
	if err != nil {
		return err
	}
	d.Status = "published"
	d.PublishedAt = e.PublishedAt
	return p.Store.Put(ctx, d)
}
