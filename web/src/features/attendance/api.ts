import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  AttendanceRecord,
  AttendanceStats,
  AttendanceStatus,
  Paginated,
} from "@/types";

export interface AttendanceFilters {
  groupeId?: string;
  studentId?: string;
  status?: AttendanceStatus;
  dateFrom?: string;
  dateTo?: string;
}

export const attendanceKeys = {
  all: (schoolId: string) => ["attendance", schoolId] as const,
  list: (schoolId: string, filters: AttendanceFilters) =>
    ["attendance", schoolId, "list", filters] as const,
  stats: (
    schoolId: string,
    groupeId: string,
    dateFrom?: string,
    dateTo?: string,
  ) => ["attendance", schoolId, "stats", groupeId, dateFrom, dateTo] as const,
};

export function useAttendanceQuery(
  schoolId: string,
  filters: AttendanceFilters,
  enabled = true,
) {
  return useQuery({
    queryKey: attendanceKeys.list(schoolId, filters),
    enabled,
    queryFn: async ({ signal }) =>
      (
        await api.get<Paginated<AttendanceRecord>>(
          `/schools/${schoolId}/attendance`,
          {
            params: {
              groupeId: filters.groupeId || undefined,
              studentId: filters.studentId || undefined,
              status: filters.status || undefined,
              dateFrom: filters.dateFrom || undefined,
              dateTo: filters.dateTo || undefined,
              all: true,
            },
            signal,
          },
        )
      ).data.data,
  });
}

export function useAttendanceStatsQuery(
  schoolId: string,
  groupeId: string,
  dateFrom?: string,
  dateTo?: string,
) {
  return useQuery({
    queryKey: attendanceKeys.stats(schoolId, groupeId, dateFrom, dateTo),
    enabled: Boolean(groupeId),
    queryFn: async ({ signal }) =>
      (
        await api.get<AttendanceStats>(
          `/schools/${schoolId}/attendance/stats`,
          {
            params: {
              groupeId,
              dateFrom: dateFrom || undefined,
              dateTo: dateTo || undefined,
            },
            signal,
          },
        )
      ).data,
  });
}

function useInvalidateAttendance(schoolId: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: attendanceKeys.all(schoolId) });
}

export interface BulkAttendanceRow {
  studentId: string;
  status: AttendanceStatus;
  heure?: string;
  motif?: string;
  justifiee?: boolean;
}

export interface BulkAttendancePayload {
  groupeId: string;
  date: string;
  records: BulkAttendanceRow[];
}

export function useBulkSetAttendanceMutation(schoolId: string) {
  const invalidate = useInvalidateAttendance(schoolId);
  return useMutation({
    mutationFn: async (payload: BulkAttendancePayload) =>
      (await api.post(`/schools/${schoolId}/attendance/bulk`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteAttendanceMutation(schoolId: string) {
  const invalidate = useInvalidateAttendance(schoolId);
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/schools/${schoolId}/attendance/${id}`)).data,
    onSuccess: invalidate,
  });
}
