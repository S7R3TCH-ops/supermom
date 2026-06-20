export function getWorkerLabel(business, personType) {
  const labels = business?.ai_profile?.worker_labels;
  return personType === 'staff'
    ? (labels?.staff ?? '🌟 Wingmom')
    : (labels?.worker ?? '🦸 Sidekick');
}
