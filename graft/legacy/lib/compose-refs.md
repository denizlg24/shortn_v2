# legacy/lib/compose-refs.ts

- PossibleRef · type · L3-L3 — type PossibleRef<T> = React.Ref<T> | undefined;
- setRef · function · L9-L17 — function setRef<T>(ref: PossibleRef<T>, value: T)
- composeRefs · function · L23-L51 — function composeRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T>
- useComposedRefs · function · L57-L61 — function useComposedRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T>
