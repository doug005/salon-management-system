export const roleHome = (role) =>
  ({ admin: "/admin", professional: "/professional", customer: "/account" })[
    role
  ] || "/login";
export const isCurrentRole = (role) =>
  ["admin", "professional", "customer"].includes(role);
