package command

import "context"

// NotifyMember is sent by the Notify organization members policy.
// The storm gives it no aggregate, so the handler sends through a port and records no event.
//
// TODO(storm): Which members? Everyone in the organization, or only hiring managers?
type NotifyMember struct {
	OrganizationID string
	JobID          string
}

type MemberNotifier interface {
	NotifyJobPublished(ctx context.Context, organizationID, jobID string) error
}

type NotifyMemberHandler struct {
	Notifier MemberNotifier
}

func (h NotifyMemberHandler) Handle(ctx context.Context, cmd NotifyMember) error {
	return h.Notifier.NotifyJobPublished(ctx, cmd.OrganizationID, cmd.JobID)
}
