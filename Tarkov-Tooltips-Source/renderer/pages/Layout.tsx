import { Outlet } from "react-router-dom";
import "../styles/index.css";

export function Layout() {
  return (
    <main className="p-2 pt-1 h-full">
      <Outlet />
    </main>
  );
}
