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

Migrate surfaces under ENG-575; legacy hooks remain until ENG-607.
Thereafter, forbid authored web `useState`; allow `useEffect` only in
`markdown-visual-editor.tsx`, `user-settings-provider.tsx` and
`use-image-file-validation.ts`. Keep only the editor's genuine selection layout
effect. Reuse uncontrolled controls. Add no setter wrappers, new state libraries
or event bus.
