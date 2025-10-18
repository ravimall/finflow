import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { LuPencil, LuTrash2 } from "react-icons/lu";

const STATUS_STYLE_MAP = {
  Login: {
    chip: "bg-yellow-100 text-yellow-700",
    border: "border-s-yellow-400",
  },
  Sanctioned: {
    chip: "bg-green-100 text-green-700",
    border: "border-s-green-500",
  },
  Disbursed: {
    chip: "bg-emerald-100 text-emerald-700",
    border: "border-s-emerald-500",
  },
  Rejected: {
    chip: "bg-red-100 text-red-700",
    border: "border-s-red-500",
  },
};

function getStatusStyles(status) {
  if (!status) {
    return {
      chip: "bg-gray-100 text-gray-600",
      border: "border-s-gray-300",
    };
  }

  const normalized = status.trim();
  return (
    STATUS_STYLE_MAP[normalized] ?? {
      chip: "bg-blue-100 text-blue-700",
      border: "border-s-blue-500",
    }
  );
}

function formatCurrency(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "—";
  }

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function LoanCompactCard({
  loan,
  onPress,
  onEdit,
  onDelete,
  isDeleteDisabled,
  isDeleting,
  index,
  onRevealActions,
}) {
  const [showActions, setShowActions] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const statusStyles = useMemo(() => getStatusStyles(loan?.status), [loan?.status]);
  const customerName = loan?.customer?.name;

  const closeActions = () => {
    setShowActions(false);
    setDragOffset(0);
  };

  const handleCardClick = () => {
    if (Math.abs(dragOffset) > 10) {
      closeActions();
      return;
    }

    onPress?.();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPress?.();
    }
    if (event.key === "Escape") {
      closeActions();
    }
  };

  const handleDragEnd = (_event, info) => {
    if (info.offset.x < -60) {
      if (!showActions) {
        onRevealActions?.();
      }
      setShowActions(true);
    } else if (info.offset.x > -10) {
      setShowActions(false);
    }

    setDragOffset(0);
  };

  const interestLabel = loan?.rate_of_interest
    ? `${loan.rate_of_interest}%`
    : loan?.loan_date || loan?.created_at
      ? new Date(loan.loan_date || loan.created_at).toLocaleDateString()
      : "";

  const appliedAmountLabel = formatCurrency(
    typeof loan?.applied_amount === "string"
      ? Number.parseFloat(loan.applied_amount)
      : loan?.applied_amount
  );

  const cardBackground =
    index % 2 === 0
      ? "bg-white hover:bg-green-100"
      : "bg-green-50 hover:bg-green-100";

  return (
    <div className="group relative">
      <div className="pointer-events-none absolute right-0 top-1/2 flex -translate-y-1/2 translate-x-1/3 gap-1 opacity-40 transition-opacity duration-200 group-hover:opacity-60">
        <LuPencil className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
        <LuTrash2 className="h-3.5 w-3.5 text-gray-500" aria-hidden="true" />
      </div>

      <div className="absolute inset-y-0 right-0 flex items-center gap-2 bg-gray-50 px-2">
        {onEdit && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeActions();
              onEdit();
            }}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 shadow-sm ring-1 ring-blue-100 transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Edit
          </button>
        )}
        {onDelete && !isDeleteDisabled && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeActions();
              onDelete();
            }}
            disabled={isDeleting}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.2}
        onDrag={(_event, info) => setDragOffset(info.offset.x)}
        onDragEnd={handleDragEnd}
        animate={{ x: showActions ? -120 : 0 }}
        className={`relative z-10 flex cursor-pointer flex-col rounded-lg p-3 text-sm shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:shadow-inner ${statusStyles.border} ${cardBackground}`}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="truncate font-semibold text-gray-800">
              {loan?.bank?.name || loan?.bank_name || "Bank"}
            </div>
            <div className="text-xs text-gray-500">
              Customer: {customerName || "N/A"}
            </div>
          </div>
          <span className="text-xs text-gray-500 sm:whitespace-nowrap">{appliedAmountLabel}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[0.65rem] font-semibold ${statusStyles.chip}`}
          >
            {loan?.status || "Unknown"}
          </span>
          <span className="text-xs text-gray-500">{interestLabel}</span>
        </div>
      </motion.div>
    </div>
  );
}

LoanCompactCard.propTypes = {
  loan: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    status: PropTypes.string,
    bank: PropTypes.shape({
      name: PropTypes.string,
    }),
    bank_name: PropTypes.string,
    rate_of_interest: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    loan_date: PropTypes.string,
    created_at: PropTypes.string,
    applied_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    customer: PropTypes.shape({
      name: PropTypes.string,
      customer_id: PropTypes.string,
    }),
  }).isRequired,
  onPress: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  isDeleteDisabled: PropTypes.bool,
  isDeleting: PropTypes.bool,
  index: PropTypes.number,
  onRevealActions: PropTypes.func,
};

LoanCompactCard.defaultProps = {
  onPress: undefined,
  onEdit: undefined,
  onDelete: undefined,
  isDeleteDisabled: false,
  isDeleting: false,
  index: 0,
  onRevealActions: undefined,
};
