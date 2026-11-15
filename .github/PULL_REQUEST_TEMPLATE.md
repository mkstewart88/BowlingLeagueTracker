## Summary
Describe the changes implemented in this pull request and reference any related issues.

## Type of Change
- [ ] Bug fix (non-breaking change addressing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Documentation update
- [ ] Windows installer / desktop host change (`desktop/host/`, `installer.nsi`)

## Verification Checklist
- [ ] `npm run lint` passes with zero TypeScript errors
- [ ] `npx tsx --test src/utils/bowlingLogic.test.ts` passes all unit tests
- [ ] `npm run build` succeeds cleanly
- [ ] If UI or desktop host changed, ran `node desktop/scripts/build-installer.mjs` cleanly
- [ ] Verified changes visually in the running app
