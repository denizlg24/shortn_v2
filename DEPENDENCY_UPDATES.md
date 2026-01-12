# Consolidated Dependency Updates

This document summarizes the dependency updates that have been consolidated from multiple Dependabot PRs.

## Summary

Five separate Dependabot pull requests (#336, #337, #338, #339, #340) have been consolidated into a single update. All changes have been applied to `package.json`.

## Updated Dependencies

| Package | Previous Version | New Version | PR |
|---------|-----------------|-------------|-----|
| next | 16.0.10 | 16.1.1 | #339 |
| motion | ^12.23.26 | ^12.26.0 | #340 |
| next-intl | ^4.5.8 | ^4.7.0 | #338 |
| nodemailer | ^7.0.11 | ^7.0.12 | #336 |
| sonner | ^2.0.5 | ^2.0.7 | #337 |

## Change Highlights

### next (16.0.10 → 16.1.1)
- Turbopack improvements
- Bug fixes for Windows symlinks
- Performance enhancements

### motion (^12.23.26 → ^12.26.0)
- Support for multiple output value maps with useTransform
- Support for auto-scrolling in Reorder.Item
- Various bug fixes

### next-intl (^4.5.8 → ^4.7.0)
- Improvements for useExtracted hook
- Better line number tracking in .po files
- Performance optimizations

### nodemailer (^7.0.11 → ^7.0.12)
- Added support for REQUIRETLS
- Fixed 8bit encoding for message/rfc822 attachments

### sonner (^2.0.5 → ^2.0.7)
- Support for multiple toasters
- Added testId prop for toast components
- Various bug fixes

## Next Steps

**IMPORTANT**: This PR needs to be merged to the `dev` branch, not `master`. Please change the base branch of PR #341 from `master` to `dev` before merging.

After merging this PR to dev:
1. Run `bun install` to update `bun.lock`
2. Test the application thoroughly
3. The original Dependabot PRs (#336-#340) can be closed as their changes are now consolidated

## Original Pull Requests

- PR #336: deps: update nodemailer requirement from ^7.0.11 to ^7.0.12
- PR #337: deps: update sonner requirement from ^2.0.5 to ^2.0.7
- PR #338: deps: update next-intl requirement from ^4.5.8 to ^4.7.0
- PR #339: deps: bump next from 16.0.10 to 16.1.1
- PR #340: deps: update motion requirement from ^12.23.26 to ^12.26.0
