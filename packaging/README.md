# Packaging #
Packaging is a multi-step process, encapsulated in the numbered executable files in this
directory. At a high level:

- make sure all the versions of the packages in the repo match the workspace.
- build all artifacts. (`webui` is transitively built by a `prepack` script in `panel`)
- build a test docker image, which will be used to sanity check the release.
- launch containers based on the test image, using the container to launch multiple
  producer and consumer containers at the same time.
- make sure that a simple metric (jobs processed, in this case) increases over time.

Over time we can elaborate on these tests and introspect more deeply to ensure
correctness, but this provides at least the minimal "can somebody run this in an
environment that looks like production?" defensive case.
