import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";
import { LuPencil, LuTrash2 } from "react-icons/lu";

const STATUS_CLASS_MAP = {
  Booking: {
    chip: "bg-yellow-100 text-yellow-700",
  },
  Disbursed: {
    chip: "bg-green-100 text-green-700",
  },
  Processing: {
    chip: "bg-blue-100 text-blue-700",
  },
  Onboarded: {
    chip: "bg-sky-100 text-sky-700",
  },
  Rejected: {
    chip: "bg-red-100 text-red-700",
  },
};

const LOAN_STATUS_CLASS_MAP = {
  Login: "bg-gray-100 text-gray-700",
  Sanctioned: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  Disbursed: "bg-emerald-100 text-emerald-700",
};

function getStatusClasses(status) {
  if (!status) {
    return "bg-gray-100 text-gray-600";
  }

  const normalized = status.trim();
  return STATUS_CLASS_MAP[normalized]?.chip ?? "bg-blue-100 text-blue-700";
}

function getLoanStatusClasses(status) {
  if (!status) {
    return "bg-blue-100 text-blue-700";
  }

  const normalized = status.trim();
  return LOAN_STATUS_CLASS_MAP[normalized] ?? "bg-blue-100 text-blue-700";
}

export default function CustomerCompactCard({
  customer,
  onPress,
  onEdit,
  onDelete,
  disableDelete,
  index,
  onRevealActions,
}) {
  const [showActions, setShowActions] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const statusChipClasses = useMemo(
    () => getStatusClasses(customer?.status),
    [customer?.status]
  );
  const loanStatusChipClasses = useMemo(
    () => getLoanStatusClasses(customer?.loan_status),
    [customer?.loan_status]
  );

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

  const cardBackground =
    index % 2 === 0
      ? "bg-white hover:bg-green-100"
      : "bg-green-50 hover:bg-green-100";

  const pendingTaskLabel =
    typeof customer?.pending_tasks === "number" && customer.pending_tasks > 0
      ? `${customer.pending_tasks} pending`
      : "No pending tasks";

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
        {onDelete && !disableDelete && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeActions();
              onDelete();
            }}
            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Delete
          </button>
        )}
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.2}
        onDrag={(_event, info) => {
          setDragOffset(info.offset.x);
        }}
        onDragEnd={handleDragEnd}
        animate={{ x: showActions ? -120 : 0 }}
        className={`relative z-10 flex cursor-pointer flex-col rounded-lg p-3 text-sm shadow-sm transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 active:shadow-inner ${cardBackground}`}
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="truncate font-semibold text-gray-800">
            {customer?.name || "Unnamed"}
          </div>
          <span className="text-xs text-gray-500">
            {customer?.customer_id || "—"}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-[0.65rem] font-semibold ${statusChipClasses}`}
            >
              {customer?.status || "Unknown"}
            </span>
            {customer?.loan_status ? (
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-[0.65rem] font-semibold ${loanStatusChipClasses}`}
              >
                {customer.loan_status}
              </span>
            ) : null}
          </div>
          <div className="text-xs text-gray-600">{pendingTaskLabel}</div>
        </div>
      </motion.div>
    </div>
  );
}

CustomerCompactCard.propTypes = {
  customer: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    customer_id: PropTypes.string,
    status: PropTypes.string,
    created_by_name: PropTypes.string,
    createdBy: PropTypes.shape({
      name: PropTypes.string,
    }),
    loan_status: PropTypes.string,
    pending_tasks: PropTypes.number,
  }).isRequired,
  onPress: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  disableDelete: PropTypes.bool,
  index: PropTypes.number,
  onRevealActions: PropTypes.func,
};

CustomerCompactCard.defaultProps = {
  onPress: undefined,
  onEdit: undefined,
  onDelete: undefined,
  disableDelete: false,
  index: 0,
  onRevealActions: undefined,
};
