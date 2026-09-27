package command

import (
	"context"
	"time"
)

// CreateActivityLog is sent by the Log activity policy.
// The storm gives it no aggregate, so the handler writes through a port and records no event.
type CreateActivityLog struct {
	SubjectID string
	Action    string
	ActorID   string
	At        time.Time
}

type ActivityLogStore interface {
	Append(ctx context.Context, entry CreateActivityLog) error
}

type CreateActivityLogHandler struct {
	Store ActivityLogStore
}

func (h CreateActivityLogHandler) Handle(ctx context.Context, cmd CreateActivityLog) error {
	return h.Store.Append(ctx, cmd)
}
