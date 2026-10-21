const SUPPORTED = new Set([
  "name",
  "main",
  "compatibility_date",
  "compatibility_flags",
  "durable_objects",
  "migrations",
  "assets",
  "services",
  "triggers",
  "vars",
  "d1_databases",
  "kv_namespaces",
  "queues",
  "workflows",
  "r2_buckets",
  "worker_loaders",
  "containers",
  "no_bundle",
  "define",
]);

const DROPPED_META = new Set([
  "configPath",
  "userConfigPath",
  "topLevelName",
  "definedEnvironments",
  "jsx_factory",
  "jsx_fragment",
  "cloudchamber",
  "dev",
  "python_modules",
  "exports",
  "upload_source_maps",
  "connect",
  "build",
  "observability",
]);

const UNSUPPORTED_SERVICES = [
  "vectorize",
  "ai_search_namespaces",
  "ai_search",
  "agent_memory",
  "hyperdrive",
  "send_email",
  "analytics_engine_datasets",
  "dispatch_namespaces",
  "mtls_certificates",
  "pipelines",
  "k2",
  "secrets_store_secrets",
  "artifacts",
  "unsafe_hello_world",
  "flagship",
  "ratelimits",
  "vpc_services",
  "vpc_networks",
  "logfwdr",
];

const isEmpty = (value) => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
};

const isEmptyService = (value) =>
  isEmpty(value) ||
  (value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value).every(isEmpty));

const requireString = (value, where) => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${where} must be a non-empty string`);
  }
  return value;
};

const normalizeD1 = (databases, migrationsDir) =>
  (databases ?? []).map((database, index) => {
    const binding = requireString(database?.binding, `d1_databases[${index}].binding`);
    const databaseName = requireString(
      database?.database_name,
      `d1_databases[${index}].database_name`,
    );
    const out = { binding, database_name: databaseName };
    if (typeof database.database_id === "string" && database.database_id.length > 0) {
      out.database_id = database.database_id;
    }
    if (migrationsDir) out.migrations_dir = migrationsDir;
    return out;
  });

const normalizeKV = (namespaces) =>
  (namespaces ?? []).map((namespace, index) => {
    const binding = requireString(namespace?.binding, `kv_namespaces[${index}].binding`);
    const id = namespace.id ?? namespace.preview_id;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(
        `kv_namespaces[${index}] needs an id or preview_id for celld`,
      );
    }
    return { binding, id };
  });

const normalizeR2 = (buckets) =>
  (buckets ?? []).map((bucket, index) => ({
    binding: requireString(bucket?.binding, `r2_buckets[${index}].binding`),
    bucket_name: requireString(
      bucket?.bucket_name,
      `r2_buckets[${index}].bucket_name`,
    ),
  }));

const normalizeQueues = (queues) => {
  if (!queues) return undefined;
  const producers = (queues.producers ?? []).map((producer, index) => {
    const out = {
      binding: requireString(
        producer?.binding,
        `queues.producers[${index}].binding`,
      ),
      queue: requireString(producer?.queue, `queues.producers[${index}].queue`),
    };
    if (Number.isInteger(producer.delivery_delay)) {
      out.delivery_delay = producer.delivery_delay;
    }
    return out;
  });
  const consumers = (queues.consumers ?? []).map((consumer, index) => {
    const out = {
      queue: requireString(consumer?.queue, `queues.consumers[${index}].queue`),
    };
    for (const key of [
      "max_batch_size",
      "max_batch_timeout",
      "max_retries",
      "dead_letter_queue",
      "max_concurrency",
      "retry_delay",
    ]) {
      if (consumer[key] !== undefined) out[key] = consumer[key];
    }
    return out;
  });
  if (producers.length === 0 && consumers.length === 0) return undefined;
  return { producers, consumers };
};

const normalizeWorkflows = (workflows) =>
  (workflows ?? []).map((workflow, index) => ({
    name: requireString(workflow?.name, `workflows[${index}].name`),
    binding: requireString(workflow?.binding, `workflows[${index}].binding`),
    class_name: requireString(
      workflow?.class_name,
      `workflows[${index}].class_name`,
    ),
  }));

const normalizeWorkerLoaders = (loaders) =>
  (loaders ?? []).map((loader, index) => ({
    binding: requireString(
      loader?.binding,
      `worker_loaders[${index}].binding`,
    ),
  }));

const normalizeAssets = (assets) => {
  if (!assets) return undefined;
  const out = {
    directory: "./client",
  };
  for (const key of ["binding", "html_handling", "not_found_handling", "run_worker_first"]) {
    if (assets[key] !== undefined) out[key] = assets[key];
  }
  return out;
};

const normalizeContainers = (containers, imageOverride) =>
  (containers ?? []).map((container, index) => {
    const out = {
      class_name: requireString(
        container?.class_name,
        `containers[${index}].class_name`,
      ),
    };
    if (imageOverride) out.image = imageOverride;
    for (const key of ["image", "name", "instance_type", "max_instances", "runtime"]) {
      if (out[key] === undefined && container[key] !== undefined) {
        out[key] = container[key];
      }
    }
    return out;
  });

export function translateVoidConfig(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Void config must be an object");
  }

  for (const key of Object.keys(input)) {
    if (SUPPORTED.has(key) || DROPPED_META.has(key) || key === "rules") continue;
    if (UNSUPPORTED_SERVICES.includes(key)) {
      if (!isEmptyService(input[key])) {
        throw new Error(
          `celld does not support \`${key}\`; remove it or target Cloudflare`,
        );
      }
      continue;
    }
    if (!isEmpty(input[key])) {
      throw new Error(`celld does not understand config key \`${key}\``);
    }
  }

  const output = {};
  const name = options.name ?? input.name;
  if (name) output.name = requireString(name, "name");
  output.main = options.main ?? input.main ?? "index.js";
  if (input.compatibility_date) {
    output.compatibility_date = input.compatibility_date;
  }
  if (input.compatibility_flags) {
    output.compatibility_flags = input.compatibility_flags;
  }
  if (input.define) output.define = input.define;

  if (input.assets) output.assets = normalizeAssets(input.assets);

  const rules = (input.rules ?? []).filter((rule) => rule?.type !== "ESModule");
  if (rules.length > 0) {
    output.rules = rules.map((rule) => ({ type: rule.type, globs: rule.globs }));
  }

  const doBindings = (input.durable_objects?.bindings ?? []).map(
    (binding, index) => ({
      name: requireString(binding?.name, `durable_objects.bindings[${index}].name`),
      class_name: requireString(
        binding?.class_name,
        `durable_objects.bindings[${index}].class_name`,
      ),
    }),
  );

  const migrations = (input.migrations ?? []).map((migration, index) => {
    const out = { tag: requireString(migration?.tag, `migrations[${index}].tag`) };
    const sqlite = [
      ...(migration.new_sqlite_classes ?? []),
      ...(migration.new_classes ?? []),
    ];
    if (sqlite.length > 0) out.new_sqlite_classes = [...new Set(sqlite)];
    return out;
  });

  const boundClasses = new Set(doBindings.map((binding) => binding.class_name));
  for (const migration of migrations) {
    for (const className of migration.new_sqlite_classes ?? []) {
      if (!boundClasses.has(className)) {
        doBindings.push({ name: `CLASS_${className}`, class_name: className });
        boundClasses.add(className);
      }
    }
  }
  if (doBindings.length > 0) output.durable_objects = { bindings: doBindings };
  const migratedClasses = new Set(
    migrations.flatMap((migration) => migration.new_sqlite_classes ?? []),
  );
  const missingMigrations = [...boundClasses].filter(
    (className) => !migratedClasses.has(className),
  );
  if (missingMigrations.length > 0) {
    migrations.push({
      tag: `celld-void-${missingMigrations.join("-").toLowerCase()}`,
      new_sqlite_classes: missingMigrations,
    });
  }
  if (migrations.length > 0) output.migrations = migrations;

  const d1 = normalizeD1(input.d1_databases, options.migrationsDir);
  if (d1.length > 0) output.d1_databases = d1;
  const kv = normalizeKV(input.kv_namespaces);
  if (kv.length > 0) output.kv_namespaces = kv;
  const r2 = normalizeR2(input.r2_buckets);
  if (r2.length > 0) output.r2_buckets = r2;
  const queues = normalizeQueues(input.queues);
  if (queues) output.queues = queues;
  const workflows = normalizeWorkflows(input.workflows);
  if (workflows.length > 0) output.workflows = workflows;
  const loaders = normalizeWorkerLoaders(input.worker_loaders);
  if (loaders.length > 0) output.worker_loaders = loaders;
  const containers = normalizeContainers(
    input.containers,
    options.containerImage,
  );
  if (containers.length > 0) {
    for (const container of containers) {
      if (!boundClasses.has(container.class_name)) {
        throw new Error(
          `container class ${container.class_name} must be declared in durable_objects.bindings`,
        );
      }
    }
    output.containers = containers;
  }

  if (input.services) output.services = input.services;
  if (input.vars || options.vars) {
    output.vars = { ...(input.vars ?? {}), ...(options.vars ?? {}) };
  }
  if (input.triggers?.crons?.length) {
    output.triggers = { crons: input.triggers.crons };
  }
  // Void genera no_bundle:true para Cloudflare, que resuelve ESM por su cuenta.
  // celld necesita bundling (esbuild) salvo que haya wasm junto al entry.
  output.no_bundle = options.noBundle ?? false;

  return output;
}
