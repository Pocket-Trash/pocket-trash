# State management

| Need | Owner |
| --- | --- |
| Local state-only transitions | `useReducer`, semantic events |
| Local async work, debounce, polling | `useEffectReducer` |
| Shared/persisted preferences | Nano Stores |
| Fields, errors, submission eligibility | TanStack Form |
| URL/data state | TanStack Router |
| Browser/DOM lifetimes | `useSyncExternalStore` / commit refs |

Keep reducers, store construction and snapshot reads free of I/O. Stop terminal
effects; replace superseded work, pass abort signals and guard late results.
Prop changes require events. Verify StrictMode/Activity resumption
without replaying completed mutations. Preserve SSR/hydration,
request/account isolation, persistence, optimistic rollback and input focus.

Authored web source, stories, tests, configuration and local browser harnesses
forbid `useState`. Use named or default React imports; broad namespace imports
and re-exports expose forbidden hooks and are restricted too.

Allow `useEffect` only in `apps/web/src/components/markdown-visual-editor.tsx`,
`apps/web/src/providers/user-settings-provider.tsx` and
`apps/web/src/hooks/use-image-file-validation.ts`. Allow `useLayoutEffect` only
for editor selection in `apps/web/src/components/markdown-editor.tsx`.
`useState` remains forbidden in every adapter. Reuse uncontrolled controls. Add
no setter wrappers, new state libraries or event bus. Native hook checks remain
active; `useEffectReducer` is not a dependency-array effect.
