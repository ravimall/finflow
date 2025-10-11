import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/api/customers/${id}`)
      .then((res) => setCustomer(res.data))
      .catch((err) => setError(err.response?.data?.error || "Unable to load customer"));
  }, [id]);

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!customer) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold mb-1">{customer.name}</h1>
        <p className="text-sm text-gray-500 font-mono">{customer.customer_id}</p>
      </header>
      <dl className="grid gap-4 md:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-gray-500">Status</dt>
          <dd className="text-lg">{customer.status}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Primary agent</dt>
          <dd className="text-lg">
            {customer.primaryAgent?.name || customer.primaryAgent?.email || "Unassigned"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Email</dt>
          <dd>{customer.email || "—"}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Phone</dt>
          <dd>{customer.phone || "—"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-sm font-medium text-gray-500">Address</dt>
          <dd>{customer.address || "—"}</dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-sm font-medium text-gray-500">Dropbox folder</dt>
          <dd className="font-mono text-xs text-gray-600">
            {customer.dropbox_folder_path || "Folder will be created on first upload"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
