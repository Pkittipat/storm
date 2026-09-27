package domain

// DomainEvent is something that happened in the domain, recorded by an aggregate.
type DomainEvent interface {
	EventName() string
}
