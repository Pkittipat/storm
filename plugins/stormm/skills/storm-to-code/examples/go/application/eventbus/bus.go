// Package eventbus delivers domain events to the policies and projections that react to them, in process.
package eventbus

import (
	"context"
	"errors"

	"example.com/jobs/domain"
)

type Bus struct {
	handlers map[string][]func(context.Context, domain.DomainEvent) error
}

func New() *Bus {
	return &Bus{handlers: map[string][]func(context.Context, domain.DomainEvent) error{}}
}

// Subscribe registers a typed handler for events of type E.
func Subscribe[E domain.DomainEvent](b *Bus, handle func(context.Context, E) error) {
	var zero E
	b.handlers[zero.EventName()] = append(b.handlers[zero.EventName()], func(ctx context.Context, e domain.DomainEvent) error {
		return handle(ctx, e.(E))
	})
}

// Publish runs every handler of every event; one failing handler doesn't stop the others.
func (b *Bus) Publish(ctx context.Context, events ...domain.DomainEvent) error {
	var errs []error
	for _, e := range events {
		for _, h := range b.handlers[e.EventName()] {
			errs = append(errs, h(ctx, e))
		}
	}
	return errors.Join(errs...)
}
