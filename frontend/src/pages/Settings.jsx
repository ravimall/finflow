import { useContext } from "react";
import SettingsItem from "../components/SettingsItem";
import { AuthContext } from "../context/AuthContext";

export default function Settings() {
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4">
      <div className="mx-auto w-full max-w-screen-md">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your personal preferences and administrative tools in one place.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <SettingsItem icon="👤" label="My Profile" to="/profile" />
          <SettingsItem icon="🗓️" label="My Tasks" to="/tasks" />
          <SettingsItem icon="📄" label="My Documents" to="/documents" />
          <SettingsItem icon="⚙️" label="App Preferences" to="/preferences" />
          {isAdmin && (
            <>
              <SettingsItem icon="🧩" label="Admin Config" to="/admin/config" />
              <SettingsItem icon="🕒" label="Audit Logs" to="/admin/audit-logs" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
