import PropTypes from "prop-types";

function statusChipClasses(status) {
  if (!status) return "bg-gray-100 text-gray-600";
  const normalized = status.toLowerCase();
  if (normalized === "approved" || normalized === "disbursed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "rejected") {
    return "bg-red-100 text-red-700";
  }
  return "bg-blue-100 text-blue-700";
}

export default function LoanList({ loans, onSelect }) {
  if (!loans.length) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
        No loans recorded for this customer.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {loans.map((loan) => (
        <li
          key={loan.id}
          className="p-3 mb-2 cursor-pointer rounded-lg bg-white text-sm shadow-sm transition hover:border-blue-300 hover:shadow-md"
          onClick={() => onSelect(loan.id)}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-gray-900">{loan.bank}</p>
              <p className="text-xs text-gray-500">Updated {loan.updated}</p>
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${statusChipClasses(
                loan.status
              )}`}
            >
              {loan.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">Aging: {loan.aging} days</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-gray-500">Applied</dt>
              <dd className="text-gray-800">{loan.applied}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-gray-500">Approved</dt>
              <dd className="text-gray-800">{loan.approved}</dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-gray-500">ROI</dt>
              <dd className="text-gray-800">{loan.roi}</dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

LoanList.propTypes = {
  loans: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      bank: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      aging: PropTypes.number.isRequired,
      applied: PropTypes.string.isRequired,
      approved: PropTypes.string.isRequired,
      roi: PropTypes.string.isRequired,
      updated: PropTypes.string.isRequired,
    })
  ).isRequired,
  onSelect: PropTypes.func.isRequired,
};
