export function getGoLabel(service) {
  const svc = (service || '').toLowerCase();
  const h = new Date().getHours();
  const pools = {
    clean:    ["Making it sparkle ✨", "Sandra's on scrub duty!", "Spotless incoming!", "Clean sweep time!"],
    organize: ["Taming the chaos!", "Order incoming!", "Clutter doesn't stand a chance", "Organize mode: ON"],
    tidy:     ["Quick strike activated!", "Rapid tidy response!", "In and out — easy!", "Lightning tidy!"],
    morning:  ["First rescue of the day!", "Rise & shine, Sandra!", "Morning hero: deployed", "First call up!"],
    general:  ["Cape up, Sandra!", "Hero mode: activated", "She's on the case!", "On my way!", "Deploying now!", "Let's do this!"],
  };
  let pool = pools.general;
  if (svc.includes('clean') || svc.includes('deep')) pool = pools.clean;
  else if (svc.includes('organ') || svc.includes('declut')) pool = pools.organize;
  else if (svc.includes('tidy') || svc.includes('quick')) pool = pools.tidy;
  else if (h < 11) pool = [...pools.morning, ...pools.general];
  return pool[Math.floor(Math.random() * pool.length)];
}
