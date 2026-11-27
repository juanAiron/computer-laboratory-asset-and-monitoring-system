import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
  Clock3,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import api from "../../api/client";
import { InstructorAvatar } from "../instructors/InstructorAvatar";
import { useAuth } from "../../hooks/useAuth";
import { useTranslation } from "../../utils/i18n";
import { ROLES } from "../../utils/roles";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DAY_ABBREVIATIONS = ["M", "T", "W", "Th", "F", "Sa"];

function getRoomFloor(roomCode) {
  return roomCode.match(/^D([0-9])/i)?.[1] || null;
}

function getFloorLabel(floorId) {
  const floorNumber = Number(floorId);
  const suffix =
    floorNumber % 100 >= 11 && floorNumber % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[floorNumber % 10] || "th";
  return `${floorNumber}${suffix} Floor`;
}

function toScheduleRoom(lab) {
  const baseCode = lab.code.match(/^D[0-9]{3}/i)?.[0] || lab.code;
  const buttonLabel = lab.schedule_button_label || lab.code;
  const compactLabel = buttonLabel.length > 8;

  return {
    code: lab.code,
    buttonLabel: compactLabel ? buttonLabel.replace(/\s+/g, "\n") : buttonLabel,
    compactLabel,
    title:
      lab.name && lab.name !== baseCode
        ? `${baseCode} - ${lab.name}`
        : baseCode,
  };
}

const DEFAULT_FLOOR = "5";
const DEFAULT_ROOM = "D522";

const EMPTY_FORM = {
  days_of_week: [0],
  start_time: "08:00",
  end_time: "09:00",
  class_code: "",
  course_number: "",
  course_name: "",
  instructor_id: "",
};

const HALF_HOUR_MINUTES = 30;
const TIMELINE_EDGE_PADDING = HALF_HOUR_MINUTES / 2;
const DEFAULT_DAY_START = 7 * 60 + HALF_HOUR_MINUTES;
const DEFAULT_DAY_END = 19 * 60 + 30;
const TIMELINE_ROW_HEIGHT = 48;
const CLASS_CODE_PATTERN = /^(?:[0-9]{4}[AB]|[0-9]{5})$/;
const COURSE_NUMBER_PATTERN =
  /^(?:(?:IT|CS) [0-9]{3}L?|ITE [0-9]{1,2}L?|CFE [0-9]{3}[A-Z]?|FOR LANG [0-9]+|MMAE [0-9]{1,2}[A-Z]?)$/;

function getErrorMessage(error, fallback) {
  return error.response?.data?.detail || fallback;
}

function getMinutesFromTime(time) {
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function formatTimeFromMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const displayHours = hours % 12 || 12;
  const period = hours < 12 ? "AM" : "PM";
  return `${displayHours}:${String(remainder).padStart(2, "0")} ${period}`;
}

function formatTime(time) {
  return formatTimeFromMinutes(getMinutesFromTime(time));
}

function formatInstructorName(name) {
  const nameWithoutTitle = name
    .trim()
    .replace(
      /^(?:(?:prof(?:essor)?|dr|mr|mrs|ms|miss|engr|engineer)\.?\s+)+/i,
      "",
    );
  const parts = nameWithoutTitle.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return nameWithoutTitle;

  const surnameParticle = (part) => part.toLowerCase().replace(/\./g, "");
  const lastThree = parts.slice(-3, -1).map(surnameParticle).join(" ");
  const lastTwo = surnameParticle(parts[parts.length - 2]);
  const surnameStart = ["de la", "de los", "de las"].includes(lastThree)
    ? parts.length - 3
    : ["de", "del", "dela", "di", "da", "dos", "la", "las", "los", "van", "von", "san", "santa"].includes(
          lastTwo,
        )
      ? parts.length - 2
      : parts.length - 1;
  const initials = parts
    .slice(0, surnameStart)
    .map((part) => `${part.replace(/\./g, "").charAt(0).toUpperCase()}.`)
    .join("");
  const surname = parts.slice(surnameStart).join(" ");
  return `${initials} ${surname}`;
}

const TIME_OPTIONS = Array.from(
  {
    length:
      (DEFAULT_DAY_END - DEFAULT_DAY_START) / HALF_HOUR_MINUTES + 1,
  },
  (_, index) => {
    const minutes = DEFAULT_DAY_START + index * HALF_HOUR_MINUTES;
    const hours = Math.floor(minutes / 60);
    return {
      value: `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
      label: formatTimeFromMinutes(minutes),
    };
  },
);

function ScheduleTimePicker({ id, label, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const containerRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (
        !containerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 4;
      const maxMenuHeight = 240;
      const spaceBelow = Math.max(
        0,
        window.innerHeight - rect.bottom - viewportPadding - gap,
      );
      const spaceAbove = Math.max(0, rect.top - viewportPadding - gap);
      const placeAbove = spaceBelow < maxMenuHeight && spaceAbove > spaceBelow;
      const availableHeight = placeAbove ? spaceAbove : spaceBelow;
      const width = Math.min(
        rect.width,
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(
          rect.left,
          window.innerWidth - width - viewportPadding,
        ),
      );

      setMenuPosition({
        left,
        width,
        maxHeight: Math.min(maxMenuHeight, availableHeight),
        top: placeAbove ? undefined : rect.bottom + gap,
        bottom: placeAbove
          ? window.innerHeight - rect.top + gap
          : undefined,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    document.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      document.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-1"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: ${formatTime(value)}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center justify-between rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 text-left text-sm font-normal text-evergreen hover:border-fern focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern"
      >
        {formatTime(value)}
        <Clock3 className="h-4 w-4 text-hunter-green" aria-hidden="true" />
      </button>
      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            id={`${id}-options`}
            role="dialog"
            aria-label={`${label} options`}
            onKeyDown={handleKeyDown}
            style={{
              position: "fixed",
              left: menuPosition.left,
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
            className="z-[80] overflow-y-auto rounded-lg border border-palm-leaf/40 bg-white p-2 shadow-xl"
          >
            <div className="grid grid-cols-1 gap-1">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={value === option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                  className={`rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern ${
                    value === option.value
                      ? "bg-fern font-semibold text-white"
                      : "text-evergreen hover:bg-lime-cream"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function InstructorPicker({
  instructors,
  value,
  onChange,
  disabled,
  label,
  placeholder,
  searchLabel,
  searchPlaceholder,
  emptyMessage,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuPosition, setMenuPosition] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const optionRefs = useRef([]);
  const selectedIndex = instructors.findIndex(
    (instructor) => String(instructor.id) === value,
  );
  const selectedInstructor =
    selectedIndex >= 0 ? instructors[selectedIndex] : null;
  const filteredInstructors = instructors.filter((instructor) =>
    instructor.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const selectedFilteredIndex = filteredInstructors.findIndex(
    (instructor) => String(instructor.id) === value,
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (
        !containerRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setMenuPosition(null);
      return undefined;
    }

    const updateMenuPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 8;
      const gap = 4;
      const maxMenuHeight = 240;
      const spaceBelow = Math.max(
        0,
        window.innerHeight - rect.bottom - viewportPadding - gap,
      );
      const spaceAbove = Math.max(0, rect.top - viewportPadding - gap);
      const placeAbove = spaceBelow < maxMenuHeight && spaceAbove > spaceBelow;
      const availableHeight = placeAbove ? spaceAbove : spaceBelow;
      const width = Math.min(
        rect.width,
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - width - viewportPadding),
      );

      setMenuPosition({
        left,
        width,
        maxHeight: Math.min(maxMenuHeight, availableHeight),
        top: placeAbove ? undefined : rect.bottom + gap,
        bottom: placeAbove
          ? window.innerHeight - rect.top + gap
          : undefined,
      });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    document.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      document.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      optionRefs.current[activeIndex]?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  const closeMenu = (restoreFocus = false) => {
    setIsOpen(false);
    setActiveIndex(-1);
    setSearchQuery("");
    if (restoreFocus) triggerRef.current?.focus();
  };

  const selectInstructor = (instructor) => {
    onChange(String(instructor.id));
    closeMenu(true);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab" && isOpen) {
      closeMenu();
      return;
    }
    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const selectedInstructor =
        filteredInstructors[activeIndex >= 0 ? activeIndex : 0];
      if (selectedInstructor) {
        selectInstructor(selectedInstructor);
      }
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || !instructors.length) {
      return;
    }

    event.preventDefault();
    if (!isOpen) {
      setSearchQuery("");
      setIsOpen(true);
      setActiveIndex(
        selectedIndex >= 0
          ? selectedIndex
          : event.key === "ArrowUp"
            ? filteredInstructors.length - 1
            : 0,
      );
      return;
    }

    if (!filteredInstructors.length) return;
    setActiveIndex((currentIndex) => {
      if (currentIndex < 0) {
        return event.key === "ArrowDown"
          ? 0
          : filteredInstructors.length - 1;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      return (
        (currentIndex + delta + filteredInstructors.length) %
        filteredInstructors.length
      );
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative mt-1"
      onKeyDown={handleKeyDown}
    >
      <input
        ref={triggerRef}
        type="text"
        disabled={disabled}
        role="combobox"
        aria-label={searchLabel}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls="schedule-instructor-options"
        aria-activedescendant={
          isOpen && activeIndex >= 0
            ? `schedule-instructor-option-${filteredInstructors[activeIndex]?.id}`
            : undefined
        }
        value={
          isOpen
            ? searchQuery
            : selectedInstructor
              ? formatInstructorName(selectedInstructor.full_name)
              : ""
        }
        placeholder={isOpen ? searchPlaceholder : placeholder}
        autoComplete="off"
        onFocus={() => {
          if (!isOpen) {
            setSearchQuery("");
            setActiveIndex(-1);
            setIsOpen(true);
          }
        }}
        onChange={(event) => {
          setSearchQuery(event.target.value);
          setActiveIndex(-1);
          setIsOpen(true);
        }}
        className="w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2 pr-10 text-left text-sm font-normal text-evergreen placeholder:text-hunter-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern disabled:cursor-not-allowed disabled:opacity-60"
      />
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hunter-green transition-transform ${
          isOpen ? "rotate-180" : ""
        }`}
        aria-hidden="true"
      />
      {isOpen &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            id="schedule-instructor-options"
            role="listbox"
            aria-label={label}
            style={{
              position: "fixed",
              left: menuPosition.left,
              top: menuPosition.top,
              bottom: menuPosition.bottom,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
            className="z-[80] overflow-y-auto rounded-lg border border-palm-leaf/40 bg-white p-1 shadow-xl"
          >
            {filteredInstructors.map((instructor, index) => {
              const selected = String(instructor.id) === value;
              const active = activeIndex === index;
              return (
                <div
                  key={instructor.id}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`schedule-instructor-option-${instructor.id}`}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectInstructor(instructor)}
                  className={`cursor-pointer rounded-md px-3 py-2 text-left text-sm text-evergreen ${
                    selected || active
                      ? "bg-lime-cream font-semibold"
                      : "hover:bg-lime-cream/70"
                  }`}
                >
                  {formatInstructorName(instructor.full_name)}
                </div>
              );
            })}
            {filteredInstructors.length === 0 && (
              <p role="status" className="px-3 py-2 text-sm text-hunter-green">
                {emptyMessage}
              </p>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function ClassSessionsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const canEdit =
    user?.role === ROLES.DEPT_HEAD || user?.role === ROLES.SUPER_ADMIN;
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(DEFAULT_FLOOR);
  const [formOpen, setFormOpen] = useState(false);
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [newRoom, setNewRoom] = useState({
    code: "",
    name: "",
    schedule_button_label: "",
  });
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [viewingSchedule, setViewingSchedule] = useState(null);
  const [scheduleToDelete, setScheduleToDelete] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState("");
  const [roomErrorMessage, setRoomErrorMessage] = useState("");
  const [codeFieldsTouched, setCodeFieldsTouched] = useState({
    class_code: false,
    course_number: false,
  });
  const classCodeInvalid =
    codeFieldsTouched.class_code &&
    Boolean(form.class_code) &&
    !CLASS_CODE_PATTERN.test(form.class_code);
  const courseNumberInvalid =
    codeFieldsTouched.course_number &&
    Boolean(form.course_number) &&
    !COURSE_NUMBER_PATTERN.test(form.course_number);

  const schedulesQuery = useQuery({
    queryKey: ["class-schedules"],
    queryFn: async () => (await api.get("/sessions/schedules")).data,
    enabled: Boolean(selectedRoom),
  });

  const labsQuery = useQuery({
    queryKey: ["labs"],
    queryFn: async () => (await api.get("/labs")).data,
  });
  const classrooms = useMemo(
    () =>
      (labsQuery.data || [])
        .filter((lab) => /^D[0-9]{3}/i.test(lab.code))
        .map(toScheduleRoom),
    [labsQuery.data],
  );
  const floorCategories = useMemo(
    () =>
      [...new Set(classrooms.map((room) => getRoomFloor(room.code)).filter(Boolean))]
        .sort((first, second) => Number(first) - Number(second))
        .map((id) => ({ id, label: getFloorLabel(id) })),
    [classrooms],
  );

  useEffect(() => {
    if (
      classrooms.length === 0 ||
      classrooms.some((room) => room.code === selectedRoom)
    ) {
      return;
    }

    const defaultRoom =
      classrooms.find((room) => room.code === DEFAULT_ROOM) || classrooms[0];
    setSelectedRoom(defaultRoom.code);
    setSelectedFloor(getRoomFloor(defaultRoom.code));
  }, [classrooms, selectedRoom]);

  const instructorsQuery = useQuery({
    queryKey: ["active-instructors"],
    queryFn: async () => (await api.get("/users/instructors")).data,
    enabled: canEdit && formOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (schedule) => {
      if (editingSchedule) {
        return api.put(
          `/sessions/schedules/${editingSchedule.id}/days`,
          schedule,
        );
      }
      return api.post("/sessions/schedules/bulk", schedule);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditingSchedule(null);
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["class-schedules"] });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error, t("Unable to save schedule.")));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scheduleId) =>
      api.delete(`/sessions/schedules/${scheduleId}`),
    onSuccess: async () => {
      setScheduleToDelete(null);
      setErrorMessage("");
      await queryClient.invalidateQueries({ queryKey: ["class-schedules"] });
    },
    onError: (error) => {
      setErrorMessage(getErrorMessage(error, t("Unable to delete schedule.")));
    },
  });

  const addRoomMutation = useMutation({
    mutationFn: async (room) => api.post("/labs", room),
    onSuccess: async ({ data: room }) => {
      await queryClient.invalidateQueries({ queryKey: ["labs"] });
      setSelectedRoom(room.code);
      setSelectedFloor(getRoomFloor(room.code));
      setRoomFormOpen(false);
      setNewRoom({ code: "", name: "", schedule_button_label: "" });
      setRoomErrorMessage("");
    },
    onError: (error) => {
      setRoomErrorMessage(getErrorMessage(error, t("Unable to add room.")));
    },
  });

  const handleAddRoom = (event) => {
    event.preventDefault();
    addRoomMutation.mutate({
      code: newRoom.code.trim().toUpperCase(),
      name: newRoom.name.trim(),
      schedule_button_label: newRoom.schedule_button_label.trim() || null,
    });
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    if (room) setSelectedFloor(getRoomFloor(room));
    setFormOpen(false);
    setEditingSchedule(null);
    setViewingSchedule(null);
    setErrorMessage("");
  };

  const handleSelectFloor = (floorId) => {
    setSelectedFloor(floorId);
    const firstRoomOnFloor = classrooms.find(
      (room) => getRoomFloor(room.code) === floorId,
    );
    if (firstRoomOnFloor && firstRoomOnFloor.code !== selectedRoom) {
      handleSelectRoom(firstRoomOnFloor.code);
    }
  };

  useEffect(() => {
    if (!viewingSchedule && !formOpen && !scheduleToDelete) return undefined;
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (saveMutation.isPending || deleteMutation.isPending) return;
      setViewingSchedule(null);
      setFormOpen(false);
      setEditingSchedule(null);
      setScheduleToDelete(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    viewingSchedule,
    formOpen,
    scheduleToDelete,
    saveMutation.isPending,
    deleteMutation.isPending,
  ]);

  const openNewSchedule = () => {
    setViewingSchedule(null);
    setEditingSchedule(null);
    setForm({ ...EMPTY_FORM, days_of_week: [...EMPTY_FORM.days_of_week] });
    setCodeFieldsTouched({ class_code: false, course_number: false });
    setFormOpen(true);
    setErrorMessage("");
  };

  const openEditSchedule = (schedule) => {
    const relatedSchedules = (schedulesQuery.data || []).filter((entry) =>
      schedule.schedule_group_id
        ? entry.schedule_group_id === schedule.schedule_group_id
        : entry.id === schedule.id,
    );
    setViewingSchedule(null);
    setEditingSchedule(schedule);
    setForm({
      days_of_week:
        relatedSchedules.length > 0
          ? relatedSchedules
              .map((entry) => entry.day_of_week)
              .sort((first, second) => first - second)
          : [schedule.day_of_week],
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      class_code: schedule.class_code || "",
      course_number: schedule.course_number || "",
      course_name: schedule.course_name,
      instructor_id: schedule.instructor ? String(schedule.instructor.id) : "",
    });
    setCodeFieldsTouched({ class_code: false, course_number: false });
    setFormOpen(true);
    setErrorMessage("");
  };

  const submitSchedule = (event) => {
    event.preventDefault();
    if (!selectedRoom) return;
    setErrorMessage("");
    if (!form.instructor_id) {
      setErrorMessage("Select an active instructor account");
      return;
    }
    const { days_of_week, ...fields } = form;
    const schedule = {
      ...fields,
      room_code: selectedRoom,
      class_code: form.class_code.trim(),
      course_number: form.course_number.trim(),
      course_name: form.course_name.trim(),
      instructor_id: Number(form.instructor_id),
    };
    schedule.days_of_week = days_of_week.map(Number);
    saveMutation.mutate({
      ...schedule,
    });
  };

  const deleteSchedule = (schedule) => {
    setErrorMessage("");
    setScheduleToDelete(schedule);
  };

  const closeScheduleForm = () => {
    if (saveMutation.isPending) return;
    setFormOpen(false);
    setEditingSchedule(null);
  };

  const closeDeleteConfirmation = () => {
    if (!deleteMutation.isPending) setScheduleToDelete(null);
  };

  const roomSchedules = (schedulesQuery.data || []).filter(
    (schedule) => schedule.room_code === selectedRoom,
  );
  const visibleClassrooms = classrooms.filter(
    (room) => !selectedFloor || getRoomFloor(room.code) === selectedFloor,
  );
  const earliestSchedule = roomSchedules.length
    ? Math.min(
        ...roomSchedules.map((schedule) =>
          getMinutesFromTime(schedule.start_time),
        ),
      )
    : DEFAULT_DAY_START;
  const latestSchedule = roomSchedules.length
    ? Math.max(
        ...roomSchedules.map((schedule) =>
          getMinutesFromTime(schedule.end_time),
        ),
      )
    : DEFAULT_DAY_END;
  const firstTimeTick =
    Math.floor(
      Math.min(DEFAULT_DAY_START, earliestSchedule) / HALF_HOUR_MINUTES,
    ) * HALF_HOUR_MINUTES;
  const lastTimeTick =
    Math.ceil(Math.max(DEFAULT_DAY_END, latestSchedule) / HALF_HOUR_MINUTES) *
    HALF_HOUR_MINUTES;
  const timelineStart = firstTimeTick - TIMELINE_EDGE_PADDING;
  const timelineEnd = lastTimeTick + TIMELINE_EDGE_PADDING;
  const timelineDuration = timelineEnd - timelineStart;
  const timeTicks = Array.from(
    {
      length:
        (lastTimeTick - firstTimeTick) / HALF_HOUR_MINUTES + 1,
    },
    (_, index) => firstTimeTick + index * HALF_HOUR_MINUTES,
  );
  const timelineHeight =
    (timelineDuration / HALF_HOUR_MINUTES) * TIMELINE_ROW_HEIGHT;
  const viewingInstructorName =
    viewingSchedule?.instructor?.full_name ||
    viewingSchedule?.instructor_name ||
    "";
  const viewingScheduleDays = viewingSchedule
    ? (schedulesQuery.data || [])
        .filter((schedule) =>
          viewingSchedule.schedule_group_id
            ? schedule.schedule_group_id ===
              viewingSchedule.schedule_group_id
            : schedule.id === viewingSchedule.id,
        )
        .map((schedule) => schedule.day_of_week)
        .filter((day, index, days) => days.indexOf(day) === index)
        .sort((first, second) => first - second)
    : [];
  const displayedScheduleDays =
    viewingScheduleDays.length > 0
      ? viewingScheduleDays
      : viewingSchedule
        ? [viewingSchedule.day_of_week]
        : [];
  const weeklyGridColumns = {
    gridTemplateColumns: "80px repeat(6, minmax(176px, 1fr))",
  };

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 px-4 py-2 md:-mx-8 md:px-8">
        <div className="mx-auto w-fit max-w-full rounded-xl bg-white px-3 py-2">
          {isSuperAdmin && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setRoomFormOpen((isOpen) => !isOpen);
                  setRoomErrorMessage("");
                }}
                className="rounded-lg bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-evergreen"
              >
                {roomFormOpen ? t("Cancel") : t("Add room")}
              </button>
            </div>
          )}
          {isSuperAdmin && roomFormOpen && (
            <form
              onSubmit={handleAddRoom}
              className="mb-3 grid gap-2 rounded-lg border border-palm-leaf/20 bg-cornsilk/40 p-3 sm:grid-cols-2"
            >
              <label className="text-xs font-semibold text-evergreen">
                {t("Room code")}
                <input
                  value={newRoom.code}
                  onChange={(event) =>
                    setNewRoom((current) => ({
                      ...current,
                      code: event.target.value.toUpperCase(),
                    }))
                  }
                  pattern="D[0-9]{3}(-[A-Z0-9]{1,6})?"
                  maxLength={10}
                  placeholder="D429"
                  required
                  className="mt-1 w-full rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen"
                />
              </label>
              <label className="text-xs font-semibold text-evergreen">
                {t("Room name")}
                <input
                  value={newRoom.name}
                  onChange={(event) =>
                    setNewRoom((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  maxLength={100}
                  required
                  className="mt-1 w-full rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen"
                />
              </label>
              <label className="text-xs font-semibold text-evergreen sm:col-span-2">
                {t("Button label")} ({t("optional")})
                <input
                  value={newRoom.schedule_button_label}
                  onChange={(event) =>
                    setNewRoom((current) => ({
                      ...current,
                      schedule_button_label: event.target.value,
                    }))
                  }
                  maxLength={100}
                  placeholder={newRoom.code || t("Defaults to room code")}
                  className="mt-1 w-full rounded-lg border border-palm-leaf/40 bg-white px-3 py-2 text-sm text-evergreen"
                />
              </label>
              {roomErrorMessage && (
                <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                  {t(roomErrorMessage)}
                </p>
              )}
              <div className="flex justify-end gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={addRoomMutation.isPending}
                  className="rounded-lg bg-hunter-green px-3 py-1.5 text-xs font-semibold text-white hover:bg-evergreen disabled:opacity-60"
                >
                  {addRoomMutation.isPending ? t("Saving…") : t("Save room")}
                </button>
              </div>
            </form>
          )}
          {labsQuery.isError && (
            <p role="alert" className="mb-2 text-sm text-red-700">
              {t("Unable to load rooms.")}
            </p>
          )}
          {!labsQuery.isLoading && !labsQuery.isError && classrooms.length === 0 && (
            <p role="status" className="mb-2 text-sm text-hunter-green">
              {t("No schedule rooms have been added yet.")}
            </p>
          )}
          <section
            aria-label={t("Filter classrooms by floor")}
            className="mb-2 flex max-w-full overflow-x-auto pb-1"
          >
            <div className="mx-auto flex w-max flex-nowrap gap-1 rounded-lg border border-palm-leaf/30 bg-white p-1">
              {floorCategories.map((floor) => (
                <button
                  key={floor.id}
                  type="button"
                  aria-pressed={selectedFloor === floor.id}
                  onClick={() => handleSelectFloor(floor.id)}
                  className="floor-filter-toggle"
                >
                  {t(floor.label)}
                </button>
              ))}
            </div>
          </section>
          <section
            aria-label={t("Classrooms")}
            className="flex flex-nowrap overflow-x-auto pb-2"
          >
            <div className="mx-auto flex w-max flex-nowrap gap-3">
              {visibleClassrooms.map((room) => {
                const isSelected = selectedRoom === room.code;

                return (
                  <button
                    key={room.code}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectRoom(room.code)}
                    className={`raised-theme-button room-selector-btn${room.compactLabel ? " room-selector-btn--compact" : ""}`}
                  >
                    {room.buttonLabel}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section
        aria-live="polite"
        className="mt-6 rounded-xl border border-palm-leaf/30 bg-white p-5 shadow-sm md:p-6"
      >
        {selectedRoom ? (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-lime-cream text-evergreen">
                  <CalendarDays className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold text-evergreen">
                  {classrooms.find((room) => room.code === selectedRoom)?.title || selectedRoom}
                </h2>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={openNewSchedule}
                  className="raised-theme-button add-schedule-btn"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  {t("Add schedule")}
                </button>
              )}
            </div>

            {errorMessage && !formOpen && !scheduleToDelete && (
              <p
                role="alert"
                className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              >
                {t(errorMessage)}
              </p>
            )}

            {schedulesQuery.isLoading ? (
              <p className="text-sm text-hunter-green">
                {t("Loading schedules...")}
              </p>
            ) : schedulesQuery.isError ? (
              <p
                role="alert"
                className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              >
                {t(
                  getErrorMessage(
                    schedulesQuery.error,
                    "Unable to load schedules.",
                  ),
                )}
              </p>
            ) : roomSchedules.length ? (
              <div className="overflow-x-auto">
                <div
                  aria-label={t("Weekly schedule")}
                  className="min-w-[1136px] overflow-hidden rounded-lg border border-palm-leaf/30"
                >
                  <div
                    className="grid bg-evergreen/5 text-sm font-semibold text-evergreen"
                    style={weeklyGridColumns}
                  >
                    <div className="border-b border-r border-palm-leaf/30 px-2 py-3 text-center text-base">
                      {t("Time")}
                    </div>
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="border-b border-r border-palm-leaf/30 px-2 py-3 text-center last:border-r-0"
                      >
                        {t(day)}
                      </div>
                    ))}
                  </div>
                  <div
                    className="grid"
                    style={{ ...weeklyGridColumns, height: timelineHeight }}
                  >
                    <div
                      className="relative border-r border-palm-leaf/30"
                    >
                      {timeTicks.map((tick) => {
                        const position =
                          ((tick - timelineStart) / timelineDuration) * 100;
                        return (
                          <span
                            key={tick}
                            className="absolute left-0 right-0 z-20 -translate-y-1/2 bg-white px-0 text-center text-sm font-medium leading-none text-hunter-green"
                            style={{ top: `${position}%` }}
                          >
                            {formatTimeFromMinutes(tick)}
                          </span>
                        );
                      })}
                    </div>
                    {DAYS.map((day, dayIndex) => {
                      const daySchedules = roomSchedules.filter(
                        (schedule) => schedule.day_of_week === dayIndex,
                      );
                      return (
                        <div
                          key={day}
                          className="relative border-r border-palm-leaf/30 last:border-r-0"
                          style={{ height: timelineHeight }}
                        >
                          {timeTicks.map((tick) => {
                            const position =
                              ((tick - timelineStart) / timelineDuration) * 100;
                            return (
                              <div
                                key={tick}
                                aria-hidden="true"
                                className="absolute left-0 right-0 border-t border-palm-leaf/20"
                                style={{ top: `${position}%` }}
                              />
                            );
                          })}
                          {daySchedules.map((schedule) => {
                            const start = getMinutesFromTime(
                              schedule.start_time,
                            );
                            const end = getMinutesFromTime(schedule.end_time);
                            const top =
                              ((start - timelineStart) / timelineDuration) *
                              100;
                            const height =
                              ((end - start) / timelineDuration) * 100;
                            const compact = height < 72;
                            const timeRange = `${formatTime(schedule.start_time)}–${formatTime(schedule.end_time)}`;
                            const instructorName =
                              schedule.instructor?.full_name ||
                              schedule.instructor_name ||
                              "";
                            const instructorDisplayName =
                              formatInstructorName(instructorName);
                            return (
                              <div
                                key={schedule.id}
                                role="group"
                                aria-label={`${schedule.course_name}, ${t(day)}, ${timeRange}`}
                                title={`${schedule.class_code || ""} ${schedule.course_number || ""} ${schedule.course_name} — ${instructorName} (${timeRange})`}
                                className={`absolute left-1 right-1 z-10 overflow-hidden rounded border border-fern/40 bg-lime-cream/90 text-evergreen shadow-sm ${
                                  compact ? "px-1 py-0.5" : "px-1.5 py-1"
                                }`}
                                style={{
                                  top: `${top}%`,
                                  height: `${height}%`,
                                  color: "#132a13",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setViewingSchedule(schedule)}
                                  aria-label={`${t("View schedule details")}: ${schedule.course_name}, ${t(day)}, ${timeRange}`}
                                  className="absolute inset-0 z-10 cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern"
                                >
                                  <span className="sr-only">
                                    {t("View schedule details")}
                                  </span>
                                </button>
                                <div className="pointer-events-none relative z-20 flex h-full min-w-0 items-center justify-center">
                                  <div className="min-w-0 flex-1 text-center">
                                    <p
                                      className={`break-words whitespace-normal text-center font-bold leading-tight ${
                                        compact ? "text-sm" : "text-base"
                                      }`}
                                    >
                                      {schedule.class_code || "—"} ·{" "}
                                      {schedule.course_number || "—"}
                                    </p>
                                    <p
                                      className={`break-words whitespace-normal text-center font-semibold leading-tight ${
                                        compact
                                          ? "mt-0.5 text-[11px]"
                                          : "mt-1 text-xs"
                                      }`}
                                    >
                                      {schedule.course_name}
                                    </p>
                                    {instructorName && (
                                      <p
                                        className={`break-words whitespace-normal text-center leading-tight ${
                                          compact
                                            ? "mt-0.5 text-[10px]"
                                            : "mt-1 text-[11px]"
                                        }`}
                                      >
                                        <span className="font-semibold">
                                          {t("Instructor")}:
                                        </span>{" "}
                                        {instructorDisplayName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {canEdit && (
                                  <div className="absolute right-1 top-1 z-30 flex items-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditSchedule(schedule)}
                                      aria-label={`${t("Edit")} ${schedule.course_name} ${t(day)}`}
                                      className="rounded bg-white/80 p-1 text-evergreen shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern"
                                    >
                                      <Pencil
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteSchedule(schedule)}
                                      disabled={deleteMutation.isPending}
                                      aria-label={`${t("Delete")} ${schedule.course_name} ${t(day)}`}
                                      className="rounded bg-white/80 p-1 text-red-700 shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
                                    >
                                      <Trash2
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-hunter-green">
                {t("There are no schedules.")}
              </p>
            )}

            {formOpen && canEdit && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-evergreen/60 p-4"
                onMouseDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    !saveMutation.isPending
                  ) {
                    closeScheduleForm();
                  }
                }}
              >
                <form
                  onSubmit={submitSchedule}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="schedule-form-title"
                  className="my-auto max-h-[90vh] w-full max-w-[44rem] overflow-y-auto rounded-xl border border-palm-leaf/30 bg-white p-4 shadow-2xl md:p-6"
                >
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <h3
                      id="schedule-form-title"
                      className="font-semibold text-evergreen"
                    >
                      {t(
                        editingSchedule
                          ? "Edit schedule entry"
                          : "Add schedule",
                      )}
                    </h3>
                    <button
                      type="button"
                      onClick={closeScheduleForm}
                      disabled={saveMutation.isPending}
                      aria-label={t("Close")}
                      className="rounded-lg p-1.5 text-hunter-green hover:bg-cornsilk/60 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  {errorMessage && (
                    <p
                      role="alert"
                      className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
                    >
                      {t(errorMessage)}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <fieldset className="sm:col-span-2 lg:col-span-3">
                      <legend className="sr-only">
                        {t(editingSchedule ? "Day" : "Days")}
                      </legend>
                      <div className="schedule-day-buttons">
                        {DAYS.map((day, index) => {
                          const selected = form.days_of_week.includes(index);
                          return (
                            <button
                              key={day}
                              type="button"
                              aria-pressed={selected}
                              aria-label={t(day)}
                              title={t(day)}
                              onClick={() => {
                                const nextDays = selected
                                  ? form.days_of_week.filter(
                                      (selectedDay) => selectedDay !== index,
                                    )
                                  : [...form.days_of_week, index].sort(
                                      (left, right) => left - right,
                                    );
                                setForm({ ...form, days_of_week: nextDays });
                              }}
                              className="schedule-day-btn"
                            >
                              <span
                                className="schedule-day-btn__shadow"
                                aria-hidden="true"
                              />
                              <span
                                className="schedule-day-btn__edge"
                                aria-hidden="true"
                              />
                              <span className="schedule-day-btn__front">
                                {DAY_ABBREVIATIONS[index]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                  <label className="text-sm font-medium text-evergreen">
                    {t("Start time")}
                    <ScheduleTimePicker
                      id="schedule-start-time"
                      label={t("Start time")}
                      value={form.start_time}
                      onChange={(start_time) => setForm({ ...form, start_time })}
                    />
                  </label>
                  <label className="text-sm font-medium text-evergreen">
                    {t("End time")}
                    <ScheduleTimePicker
                      id="schedule-end-time"
                      label={t("End time")}
                      value={form.end_time}
                      onChange={(end_time) => setForm({ ...form, end_time })}
                    />
                  </label>
                  <label className="text-sm font-medium text-evergreen">
                    {t("Class Code")}
                    <input
                      required
                      maxLength={5}
                      pattern={CLASS_CODE_PATTERN.source}
                      title={t(
                        "Class code must be four digits followed by A or B, or exactly five digits.",
                      )}
                      aria-invalid={classCodeInvalid}
                      placeholder="9446A"
                      value={form.class_code}
                      onBlur={() =>
                        setCodeFieldsTouched({
                          ...codeFieldsTouched,
                          class_code: true,
                        })
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          class_code: event.target.value.toUpperCase(),
                        })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 ${
                        classCodeInvalid
                          ? "border-red-500"
                          : "border-palm-leaf/50"
                      }`}
                    />
                    {classCodeInvalid && (
                      <span className="mt-1 block text-xs font-normal text-red-700">
                        {t(
                          "Use 4 digits followed by A or B (e.g. 9446A), or exactly 5 digits.",
                        )}
                      </span>
                    )}
                  </label>
                  <label className="text-sm font-medium text-evergreen">
                    {t("Course Code")}
                    <input
                      required
                      maxLength={20}
                      pattern={COURSE_NUMBER_PATTERN.source}
                      title={t(
                        "Use a course code such as IT 111, IT 111L, CS 213, ITE 15, CFE 106A, FOR LANG 1, or MMAE 15.",
                      )}
                      aria-invalid={courseNumberInvalid}
                      placeholder="IT 111"
                      value={form.course_number}
                      onBlur={() =>
                        setCodeFieldsTouched({
                          ...codeFieldsTouched,
                          course_number: true,
                        })
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          course_number: event.target.value.toUpperCase(),
                        })
                      }
                      className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 ${
                        courseNumberInvalid
                          ? "border-red-500"
                          : "border-palm-leaf/50"
                      }`}
                    />
                    {courseNumberInvalid && (
                      <span className="mt-1 block text-xs font-normal text-red-700">
                        {t(
                          "Examples: IT 111, IT 111L, CS 213, ITE 15, CFE 106A, FOR LANG 1, MMAE 15.",
                        )}
                      </span>
                    )}
                  </label>
                  <label className="text-sm font-medium text-evergreen">
                    {t("Course")}
                    <input
                      required
                      maxLength={100}
                      placeholder="Applications Development"
                      value={form.course_name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          course_name: event.target.value.toUpperCase(),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-palm-leaf/50 bg-white px-3 py-2"
                    />
                  </label>
                  <label className="text-sm font-medium text-evergreen">
                    {t("Instructor")}
                    <InstructorPicker
                      instructors={instructorsQuery.data || []}
                      value={form.instructor_id}
                      label={t("Instructor")}
                      placeholder={t("Choose an instructor")}
                      searchLabel={t("Search instructors")}
                      searchPlaceholder={t("Search instructors")}
                      emptyMessage={t("No instructors found.")}
                      disabled={
                        instructorsQuery.isLoading ||
                        !instructorsQuery.data?.length
                      }
                      onChange={(instructor_id) =>
                        setForm({ ...form, instructor_id })
                      }
                    />
                    {instructorsQuery.isError && (
                      <span
                        role="alert"
                        className="mt-1 block text-xs text-red-700"
                      >
                        {t("Unable to load active instructors.")}
                      </span>
                    )}
                    {!instructorsQuery.isLoading &&
                      !instructorsQuery.isError &&
                      !instructorsQuery.data?.length && (
                        <span className="mt-1 block text-xs text-red-700">
                          {t(
                            "No active instructors are available. Create or activate an instructor account first.",
                          )}
                        </span>
                      )}
                  </label>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-hunter-green">
                      {t(
                        "Each selected day will appear as a separate schedule row.",
                      )}
                    </p>
                    <button
                      type="submit"
                      disabled={
                        saveMutation.isPending ||
                        !form.instructor_id ||
                        !instructorsQuery.data?.length ||
                        !form.days_of_week.length
                      }
                      className="rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-cornsilk disabled:opacity-50"
                    >
                      {t(saveMutation.isPending ? "Saving..." : "Save")}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-hunter-green">
            {t("Select a classroom to view its schedule.")}
          </p>
        )}
      </section>
      {viewingSchedule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-evergreen/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewingSchedule(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-details-title"
            className="w-full max-w-lg rounded-xl border border-palm-leaf/30 bg-white p-5 shadow-2xl md:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-hunter-green">
                  {t("Schedule details")}
                </p>
                <h2
                  id="schedule-details-title"
                  className="mt-1 text-xl font-bold text-evergreen"
                >
                  {viewingSchedule.course_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingSchedule(null)}
                aria-label={t("Close")}
                className="rounded-lg p-1.5 text-hunter-green hover:bg-cornsilk/60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <dl className="grid gap-4 rounded-lg bg-cornsilk/40 p-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-hunter-green">
                  {t("Class Code")}
                </dt>
                <dd className="mt-1 font-semibold text-evergreen">
                  {viewingSchedule.class_code || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-hunter-green">
                  {t("Course Code")}
                </dt>
                <dd className="mt-1 font-semibold text-evergreen">
                  {viewingSchedule.course_number || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-hunter-green">
                  {t("Room")}
                </dt>
                <dd className="mt-1 font-semibold text-evergreen">
                  {classrooms.find((room) => room.code === viewingSchedule.room_code)?.title ||
                    viewingSchedule.room_code}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-hunter-green">
                  {t("Day")}
                </dt>
                <dd className="mt-1 font-semibold text-evergreen">
                  <span
                    aria-label={displayedScheduleDays
                      .map((day) => t(DAYS[day]))
                      .join(", ")}
                  >
                    {displayedScheduleDays
                      .map((day) => DAY_ABBREVIATIONS[day])
                      .join("")}
                  </span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold text-hunter-green">
                  {t("Time")}
                </dt>
                <dd className="mt-1 font-semibold text-evergreen">
                  {formatTime(viewingSchedule.start_time)}–
                  {formatTime(viewingSchedule.end_time)}
                </dd>
              </div>
            </dl>
            <div className="mt-5 flex items-center gap-4 rounded-lg border border-palm-leaf/30 p-4">
              <InstructorAvatar
                name={viewingInstructorName}
                photoUrl={viewingSchedule.instructor?.profile_photo_url}
                className="h-16 w-16 text-xl"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-hunter-green">
                  {t("Instructor")}
                </p>
                <p className="mt-1 font-semibold text-evergreen">
                  {viewingInstructorName || t("Not assigned")}
                </p>
                {viewingSchedule.instructor?.email && (
                  <p className="mt-1 break-all text-sm text-hunter-green">
                    {viewingSchedule.instructor.email}
                  </p>
                )}
                {viewingSchedule.instructor?.department && (
                  <p className="mt-1 text-sm text-hunter-green">
                    {viewingSchedule.instructor.department}
                  </p>
                )}
                {viewingSchedule.instructor?.office && (
                  <p className="text-sm text-hunter-green">
                    {viewingSchedule.instructor.office}
                  </p>
                )}
              </div>
              {viewingSchedule.instructor?.id && (
                <Link
                  to={`/instructors/${viewingSchedule.instructor.id}`}
                  className="ml-auto inline-flex shrink-0 rounded-lg bg-hunter-green px-3 py-1.5 text-sm font-semibold text-cornsilk transition-colors hover:bg-evergreen focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fern"
                >
                  {t("Profile")}
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
      {scheduleToDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-evergreen/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDeleteConfirmation();
            }
          }}
        >
          <section
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-schedule-title"
            aria-describedby="delete-schedule-description"
            className="w-full max-w-md rounded-xl border border-palm-leaf/30 bg-white p-5 shadow-2xl md:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="delete-schedule-title"
                  className="text-lg font-semibold text-evergreen"
                >
                  {t("Delete")}
                </h2>
                <p
                  id="delete-schedule-description"
                  className="mt-2 text-sm text-hunter-green"
                >
                  {t("Delete this schedule entry?")}
                </p>
                <p className="mt-2 text-sm font-semibold text-evergreen">
                  {scheduleToDelete.class_code}{" "}
                  {scheduleToDelete.course_number} ·{" "}
                  {scheduleToDelete.course_name}
                </p>
              </div>
            </div>
            {errorMessage && (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
              >
                {t(errorMessage)}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deleteMutation.isPending}
                className="rounded-lg border border-palm-leaf/40 bg-white px-4 py-2 text-sm font-semibold text-evergreen disabled:opacity-50"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage("");
                  deleteMutation.mutate(scheduleToDelete.id);
                }}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {t(deleteMutation.isPending ? "Deleting..." : "Delete")}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
