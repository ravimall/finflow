import LoanForm from "../components/LoanForm";
import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Loans() {
  const [loans, setLoans] = useState([]);

  const fetchLoans = useCallback(() => {
    api
      .get("/api/loans")
      .then((res) => setLoans(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  return (
    <>
      <div className="mb-6">
        <LoanForm onSuccess={fetchLoans} />
      </div>
      <div>
        <h1 className="text-xl font-bold mb-4">Loans</h1>
        <ul>
          {loans.map(l => (
            <li key={l.id}>
              {l.bank_name} - {l.status}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

