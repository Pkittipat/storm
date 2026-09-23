# @stormm/codegen — R&D

Turns a Stormm process (aggregates, commands, events and their connections) into Go domain code.
**Not used by the app yet.** This package is an experiment; nothing in `apps/api` or `apps/web` calls it on `main`.

```
pnpm codegen path/to/process.yaml     # writes a preview to .stormm-tmp/<process id>/ (git-ignored)
pnpm --filter @stormm/codegen test    # includes a real `go build`, `go vet`, `gofmt` and `go test` on the output
```

- One Go package per aggregate. `*_gen.go` files are generated and overwritten; hook and type stubs
  (`<aggregate>.go`, `types.go`) are created once and belong to the developers.
- Gaps in the storm come back as issues, not failures.
- The output path and Go module path are options (`generateGo(board, { outputRoot, modulePath, goMod })`).

The wiring into the app (a Code panel, and committing the generated code with the YAML on save) lives on the
`feat/codegen` branch until this experiment is ready to be adopted.
