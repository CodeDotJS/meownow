# iOS

Android Share Target is the capture path on an installed PWA. iOS Safari does not implement it.

v1: paste in the installed app (Safari shows a native paste callout). A Shortcuts automation that POSTs clipboard text is possible but is not built here — it would send plaintext to the origin unless the shortcut encrypts first, which Shortcuts cannot do.

Do not add a server route that accepts plaintext clipboard from iOS.
