package policy

import (
	"context"

	"example.com/jobs/application/command"
	"example.com/jobs/domain"
)

// LogActivity: whenever a job is published, log the activity.
type LogActivity struct {
	CreateActivityLog interface {
		Handle(context.Context, command.CreateActivityLog) error
	}
}

func (p LogActivity) Handle(ctx context.Context, e domain.JobPublished) error {
	return p.CreateActivityLog.Handle(ctx, command.CreateActivityLog{
		SubjectID: e.JobID,
		Action:    e.EventName(),
		ActorID:   e.PublishedBy,
		At:        e.PublishedAt,
	})
}
