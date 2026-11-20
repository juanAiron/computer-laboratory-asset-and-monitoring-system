export const ROLES = {
  TRIL_ADMIN: 'tril_admin',
  DEPT_HEAD: 'dept_head',
  CUSTODIAN: 'custodian',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
}

export const ROLE_LABELS = {
  tril_admin: 'TRIL Coordinator',
  dept_head: 'Department Head',
  custodian: 'Lab Custodian',
  instructor: 'Instructor',
  student: 'Student',
}

export function hasRole(user, allowedRoles) {
  if (!user) return false
  return allowedRoles.includes(user.role)
}