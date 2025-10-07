import LoanForm from "../components/LoanForm";
import { useEffect, useState } from "react";
import axios from "axios";

export default function Loans() {
  const [loans, setLoans] = useState([]);

  useEffect(() => {
    axios.get("https://shubhadevelopers.com/api/loans")
      .then(res => setLoans(res.data))
      .catch(err => console.error(err));
  }, []);

  return (
      <>
    <div className="mb-6"><LoanForm /></div>
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