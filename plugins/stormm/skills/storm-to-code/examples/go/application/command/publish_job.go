package command

import (
	"context"
	"time"

	"example.com/jobs/domain"
)

// PublishJob is performed by a Recruiter, from the Job Detail view.
type PublishJob struct {
	JobID       string
	RecruiterID string
}

// EventPublisher hands recorded events to whatever reacts to them.
type EventPublisher interface {
	Publish(ctx context.Context, events ...domain.DomainEvent) error
}

type PublishJobHandler struct {
	Jobs   domain.JobRepository
	Events EventPublisher
	Now    func() time.Time
}

func (h PublishJobHandler) Handle(ctx context.Context, cmd PublishJob) error {
	job, err := h.Jobs.Get(ctx, cmd.JobID)
	if err != nil {
		return err
	}
	if err := job.Publish(cmd.RecruiterID, h.Now()); err != nil {
		return err
	}
	events := job.PullEvents()
	if err := h.Jobs.Save(ctx, job); err != nil {
		return err
	}
	return h.Events.Publish(ctx, events...)
}
