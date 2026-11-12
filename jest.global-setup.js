// Fixtures are written in US Eastern wall-clock time (engine/plan.test.ts); format them the same way.
export default () => {
  process.env.TZ = 'America/New_York';
};
