import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import api from "../../api/client";
import { InstructorAvatar } from "./InstructorAvatar";
import { useTranslation } from "../../utils/i18n";

export function InstructorProfilePage() {
  const { instructorId } = useParams();
  const { t } = useTranslation();
  const instructorQuery = useQuery({
    queryKey: ["instructor-profile", instructorId],
    queryFn: async () =>
      (await api.get(`/users/instructors/${instructorId}`)).data,
    enabled: Boolean(instructorId),
  });

  return (
    <div className="space-y-5">
      <Link
        to="/sessions"
        className="inline-flex items-center gap-2 text-sm font-semibold text-hunter-green hover:text-evergreen"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("Back to schedules")}
      </Link>

      <section className="rounded-xl border border-palm-leaf/30 bg-white p-5 shadow-sm md:p-6">
        <h1 className="text-xl font-bold text-evergreen">
          {t("Instructor Profile")}
        </h1>

        {instructorQuery.isPending && (
          <p className="mt-4 text-sm text-hunter-green">
            {t("Loading instructor profile...")}
          </p>
        )}

        {instructorQuery.isError && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {t(
              instructorQuery.error.response?.data?.detail ||
                "Unable to load instructor profile.",
            )}
          </p>
        )}

        {instructorQuery.data && (
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <InstructorAvatar
              name={instructorQuery.data.full_name}
              photoUrl={instructorQuery.data.profile_photo_url}
              className="h-20 w-20 text-2xl"
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-evergreen">
                {instructorQuery.data.full_name}
              </h2>
              <p className="mt-1 break-all text-sm text-hunter-green">
                {instructorQuery.data.email}
              </p>
              {instructorQuery.data.department && (
                <p className="mt-2 text-sm text-hunter-green">
                  <span className="font-semibold">{t("Department")}:</span>{" "}
                  {instructorQuery.data.department}
                </p>
              )}
              {instructorQuery.data.office && (
                <p className="mt-1 text-sm text-hunter-green">
                  <span className="font-semibold">{t("Office")}:</span>{" "}
                  {instructorQuery.data.office}
                </p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
