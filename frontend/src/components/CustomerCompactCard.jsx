import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";

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

function getStatusClasses(status) {
  if (!status) {
    return "bg-gray-100 text-gray-600";
  }

  const normalized = status.trim();
  return STATUS_CLASS_MAP[normalized]?.chip ?? "bg-blue-100 text-blue-700";
}

function getCreatedByLabel(customer) {
  return (
    customer?.created_by_name ||
    customer?.createdBy?.name ||
    customer?.created_by ||
    customer?.createdByName ||
    customer?.createdByEmail ||
    customer?.created_by_email ||
    "Unknown"
  );
}

export default function CustomerCompactCard({
  customer,
  onPress,
  onEdit,
  onDelete,
  disableDelete,
}) {
  const [showActions, setShowActions] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const createdByLabel = useMemo(() => getCreatedByLabel(customer), [customer]);
  const statusChipClasses = useMemo(
    () => getStatusClasses(customer?.status),
    [customer?.status]
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
      setShowActions(true);
    } else if (info.offset.x > -10) {
      setShowActions(false);
    }

    setDragOffset(0);
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
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
        className="relative z-10 flex cursor-pointer flex-col gap-1 rounded-xl border border-gray-100 bg-white p-3 text-sm shadow-sm transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-gray-900">
              {customer?.name || "Unnamed"}
            </span>
            <span className="font-mono text-[0.65rem] uppercase tracking-wide text-gray-500">
              {customer?.customer_id || "—"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-[0.65rem] font-semibold ${statusChipClasses}`}
          >
            {customer?.status || "Unknown"}
          </span>
          <span className="truncate text-[0.7rem] text-gray-500">
            By {createdByLabel}
          </span>
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
  }).isRequired,
  onPress: PropTypes.func,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  disableDelete: PropTypes.bool,
};

CustomerCompactCard.defaultProps = {
  onPress: undefined,
  onEdit: undefined,
  onDelete: undefined,
  disableDelete: false,
};
