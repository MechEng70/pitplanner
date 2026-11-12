# Home Assistant entities (Phase 0, read 2026-11-12)

Read-only survey of Jason's Home Assistant for the Pit Planner HA work (HA-INTEGRATION.md). Nothing in HA
was changed. The grill and probes were off, so every entity read `unavailable`; values, units and ranges
still need a live read during a cook.

## Pit Boss smoker (integration `pitboss`, ha-pitboss)

Device "PitBossSmoker", area Patio. Registry model PB850SPW2 = **Pit Boss Sportsman 850** (confirmed by Jason),
firmware 16.8.7. Catalog entry `pitboss-sportsman-850` in data/cookers.json; pick it in Gear (it replaces the 820).

| Use in Pit Planner | Entity |
|---|---|
| Pit temp, current and set point (climate) | `climate.patio_pitbosssmoker_grill_temperature` |
| Grill probe 1 | `sensor.patio_pitbosssmoker_probe_1` |
| Grill probe 2 | `sensor.patio_pitbosssmoker_probe_2` |
| Probes 3 and 4 (registry only, likely disabled, default names) | `sensor.pbc2_8c4f001a77a4_probe_3`, `sensor.pbc2_8c4f001a77a4_probe_4` |
| Probe targets (number) | `number.patio_pitbosssmoker_probe_1_target`, `..._probe_2_target` |
| Probe target reached | `binary_sensor.patio_pitbosssmoker_probe_1_target_reached`, `..._probe_2_target_reached` |
| Errors (blueprint: notify at once) | `binary_sensor.patio_pitbosssmoker_startup_error`, `_high_temperature_error`, `_fan_error`, `_igniter_error`, `_auger_error`, `_probe_1_error`, `_probe_2_error`, `_probe_3_error` |
| Out of pellets | `binary_sensor.patio_pitbosssmoker_no_pellets` |
| Connection to the grill | `binary_sensor.patio_pitbosssmoker_connectivity` |
| Running state | `binary_sensor.patio_pitbosssmoker_auger`, `_fan`, `_igniter`, `_meat_probe_control` |
| Grill unit (F/C) | `select.patio_pitbosssmoker_grill_temperature_unit` |
| Diagnostics | `sensor.patio_pitbosssmoker_controller_uptime`, `_controller_free_memory`, `_firmware_version` |

Never touched by Pit Planner (HA-INTEGRATION 3.4): `switch.patio_pitbosssmoker_module_power`,
`switch.patio_pitbosssmoker_prime`, `button.patio_pitbosssmoker_restart_controller`,
`button.patio_pitbosssmoker_request_fast_updates`, and the `pitboss.start_grill` action.

Not found: recipe progress, separate smoker/chamber temperature sensors.

## Chef iQ wireless probes (integration `chef_iq`, Bluetooth)

Three CQ60 probes, area Kitchen, renamed in HA to Probe 1-3. Same entities per probe (`<id>` = `8c86`, `3e2c`, `2a7b`):

| | Probe 1 (`8c86`) | Probe 2 (`3e2c`) | Probe 3 (`2a7b`) |
|---|---|---|---|
| Food temp (use this) | `sensor.cq60_8c86_food_temperature` | `sensor.cq60_3e2c_food_temperature` | `sensor.cq60_2a7b_food_temperature` |
| Ambient temp | `sensor.cq60_8c86_ambient_temperature` | `sensor.cq60_3e2c_ambient_temperature` | `sensor.cq60_2a7b_ambient_temperature` |

Also in the registry per probe (checked on Probe 1; likely disabled by default, they did not show in entity
search): `sensor.cq60_<id>_battery`, `_soc_temperature`, `_signal_strength`, `_probe_tip_1_temperature`,
`_probe_tip_2_temperature`, `_probe_tip_3_temperature`. The probe batteries were dead at the survey (2026-11-12);
recheck the `battery` entities once charged, and enable them if they are disabled, for the low-battery alert.

## Notifications

- Existing automation `automation.pitboss_probe_temp_notify`: on probe 1 or 2 "target reached" while module
  power is on, calls `script.notify_jason` and `script.notify_telegram` ("Probes have reached marked Temperature").
  It overlaps with the planned Pit Planner blueprint; Jason will disable it while the app's alerts are running.
- Five `notify.mobile_app_*` services exist. Which one is Jason's phone (and his wife's): Jason to confirm,
  or have the blueprint take a script like `script.notify_jason` as its notify input.

## Open from Phase 0

- ha-pitboss connection mode (`wss` / `local` / `ble`): not read; check the integration's options.
- Registry reads as a non-admin user (HA-INTEGRATION 4.3): not tested. This survey used an admin
  connection. The `pitplanner` HA user now exists (Jason has the credentials); test with it in Phase 1.
- The MCP server used here is the ha-mcp add-on with full read and write tools over every entity, not HA's
  built-in MCP server limited to exposed entities (HA-INTEGRATION section 2). Only read tools were used.
