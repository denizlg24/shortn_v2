// Plain data shared by server pages and the client form; it can't live in
// the "use client" module, where exports become client references.
export interface LinkFormValues {
  url: string;
  key: string;
  title: string;
  description: string;
  tags: string[];
  hasPassword: boolean;
  passwordHint: string;
}

export const emptyLinkValues: LinkFormValues = {
  url: "",
  key: "",
  title: "",
  description: "",
  tags: [],
  hasPassword: false,
  passwordHint: "",
};
