import { HOTEL_RESOURCES, PLATFORM_RESOURCES, ROLES } from '@annapurna/constants';
export function canAccessResource(role: string | undefined, resource: string) {
  const allowed =
    role === ROLES.admin ? PLATFORM_RESOURCES : role === ROLES.owner ? HOTEL_RESOURCES : [];
  return (allowed as readonly string[]).includes(resource);
}
