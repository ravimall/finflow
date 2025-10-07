import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function CustomerDetail() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    api.get(`/api/customers/${id}`)
      .then(res => setCustomer(res.data))
      .catch(err => console.error(err));
  }, [id]);

  if (!customer) return <p>Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{customer.name}</h1>
      <p>Email: {customer.email}</p>
      <p>Phone: {customer.phone}</p>
      <p>Status: {customer.status}</p>
    </div>
  );
}

