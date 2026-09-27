# stormm-explain (comparison variant)

The same `storm-to-code` skill as [../stormm](../stormm), with one difference: Claude reads the storm through the `stormm explain` summary first, instead of reading the YAML directly. Use it to compare the two approaches on the same storm and prompt. It isn't listed in the marketplace.

```
claude --plugin-dir path/to/stormm/plugins/stormm-explain
```

Load only one of the two plugins at a time: both provide a skill named `storm-to-code`.
