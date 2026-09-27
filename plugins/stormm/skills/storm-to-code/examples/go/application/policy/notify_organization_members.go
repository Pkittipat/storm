package policy

import (
	"context"

	"example.com/jobs/application/command"
	"example.com/jobs/domain"
)

// NotifyOrganizationMembers: whenever a job is published, notify the organization's members.
type NotifyOrganizationMembers struct {
	NotifyMember interface {
		Handle(context.Context, command.NotifyMember) error
	}
}

func (p NotifyOrganizationMembers) Handle(ctx context.Context, e domain.JobPublished) error {
	return p.NotifyMember.Handle(ctx, command.NotifyMember{
		OrganizationID: e.OrganizationID,
		JobID:          e.JobID,
	})
}
