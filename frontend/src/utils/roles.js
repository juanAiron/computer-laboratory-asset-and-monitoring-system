export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  TRIL_ADMIN: 'tril_admin',
  DEPT_HEAD: 'dept_head',
  CUSTODIAN: 'custodian',
  INSTRUCTOR: 'instructor',
  STUDENT: 'student',
}

export const ROLE_LABELS = {
  super_admin: 'Super Administrator',
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