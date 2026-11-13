export type DispatchRole = "admin" | "dispatcher";

export type DispatchAccount = {
  user_id: string;
  email: string;
  display_name: string;
  role: DispatchRole;
  active: boolean;
};
