export const loggerMessages = {
  api: {
    cronHourly: "api.cron.hourly",
    healthChecked: "api.health.checked",
    serverListening: "api.server.listening",
    workerUnhandledException: "api.worker.unhandledException",
  },
  ci: {
    database: {
      preview: {
        branchCleanupSkipped: "ci.database.preview.branchCleanup.skipped",
        branchCreated: "ci.database.preview.branch.created",
        branchDeleted: "ci.database.preview.branch.deleted",
        branchExpirationSet: "ci.database.preview.branch.expiration.set",
        branchLimitReached: "ci.database.preview.branchLimit.reached",
        changeDetectionCompleted:
          "ci.database.preview.changeDetection.completed",
        migrationsApplied: "ci.database.preview.migrations.applied",
        migrationsFailed: "ci.database.preview.migrations.failed",
        noPrBranchNeeded: "ci.database.preview.noPrBranch.needed",
        prBranchReused: "ci.database.preview.prBranch.reused",
        databaseSelected: "ci.database.preview.database.selected",
        reset: "ci.database.preview.reset",
        sharedDatabaseSelected: "ci.database.preview.sharedDatabase.selected",
      },
      production: {
        databaseSelected: "ci.database.production.database.selected",
        migrationsApplied: "ci.database.production.migrations.applied",
        migrationsFailed: "ci.database.production.migrations.failed",
      },
    },
    github: {
      dbChangeLabelSynced: "ci.github.dbChangeLabel.synced",
    },
    vercel: {
      preview: {
        databaseOverrideMissing: "ci.vercel.preview.databaseOverride.missing",
        databaseOverrideRemoved: "ci.vercel.preview.databaseOverride.removed",
        databaseOverrideSet: "ci.vercel.preview.databaseOverride.set",
        latestDeploymentResolved: "ci.vercel.preview.latestDeployment.resolved",
        latestDeploymentUnavailable:
          "ci.vercel.preview.latestDeployment.unavailable",
      },
    },
  },
  common: {},
  database: {
    featureFlags: {
      archive: "database.featureFlags.archive",
      create: "database.featureFlags.create",
      evaluate: "database.featureFlags.evaluate",
      listAdmin: "database.featureFlags.listAdmin",
      listAdminTargetingForUser:
        "database.featureFlags.listAdminTargetingForUser",
      listUserBeta: "database.featureFlags.listUserBeta",
      setAdminOverride: "database.featureFlags.setAdminOverride",
      setUserPreference: "database.featureFlags.setUserPreference",
      update: "database.featureFlags.update",
    },
    userSettings: {
      getByClerkId: "database.userSettings.getByClerkId",
      patchForClerkId: "database.userSettings.patchForClerkId",
      upsertForClerkId: "database.userSettings.upsertForClerkId",
    },
    users: {
      ensure: "database.users.ensure",
      getByClerkId: "database.users.getByClerkId",
    },
  },
  featureFlags: {
    evaluationFailedClosed: "featureFlags.evaluation.failedClosed",
  },
  images: {
    delete: "images.delete",
    update: "images.update",
    upload: "images.upload",
  },
  scraper: {
    autmog: {
      fetchCompleted: "scraper.autmog.fetch.completed",
      fetchFailed: "scraper.autmog.fetch.failed",
      producerCompleted: "scraper.autmog.producer.completed",
      producerStarted: "scraper.autmog.producer.started",
    },
    grimsmo: {
      fetchCompleted: "scraper.grimsmo.fetch.completed",
      fetchFailed: "scraper.grimsmo.fetch.failed",
      producerCompleted: "scraper.grimsmo.producer.completed",
      producerStarted: "scraper.grimsmo.producer.started",
    },
    cron: {
      completed: "scraper.cron.completed",
      failed: "scraper.cron.failed",
      runSkipped: "scraper.cron.run.skipped",
      started: "scraper.cron.started",
      taskCompleted: "scraper.cron.task.completed",
      taskFailed: "scraper.cron.task.failed",
      taskSkipped: "scraper.cron.task.skipped",
      taskStarted: "scraper.cron.task.started",
    },
    database: {
      archiveCompleted: "scraper.database.archive.completed",
      mutationCompleted: "scraper.database.mutation.completed",
      mutationFailed: "scraper.database.mutation.failed",
    },
    image: {
      deleteCompleted: "scraper.image.delete.completed",
      deleteFailed: "scraper.image.delete.failed",
      deleteSkipped: "scraper.image.delete.skipped",
      uploadCompleted: "scraper.image.upload.completed",
      uploadFailed: "scraper.image.upload.failed",
      uploadSkipped: "scraper.image.upload.skipped",
    },
    healthChecked: "scraper.health.checked",
    processor: {
      completed: "scraper.processor.completed",
      errorSummary: "scraper.processor.errors.summary",
      failed: "scraper.processor.failed",
      imageJobCompleted: "scraper.processor.imageJob.completed",
      imageJobFailed: "scraper.processor.imageJob.failed",
      itemJobCompleted: "scraper.processor.itemJob.completed",
      itemJobFailed: "scraper.processor.itemJob.failed",
      started: "scraper.processor.started",
    },
    queue: {
      deadLetterCompleted: "scraper.queue.deadLetter.completed",
      deadLetterFailed: "scraper.queue.deadLetter.failed",
      deadLetterStarted: "scraper.queue.deadLetter.started",
      drainCompleted: "scraper.queue.drain.completed",
      drainFailed: "scraper.queue.drain.failed",
      enqueueCompleted: "scraper.queue.enqueue.completed",
      enqueueFailed: "scraper.queue.enqueue.failed",
    },
    run: {
      completed: "scraper.run.completed",
      failed: "scraper.run.failed",
      started: "scraper.run.started",
    },
    scheduler: {
      lockSkipped: "scraper.scheduler.lock.skipped",
      started: "scraper.scheduler.started",
      stopped: "scraper.scheduler.stopped",
      taskCompleted: "scraper.scheduler.task.completed",
      taskFailed: "scraper.scheduler.task.failed",
      taskStarted: "scraper.scheduler.task.started",
    },
    serverFailed: "scraper.server.failed",
    serverListening: "scraper.server.listening",
    serverStopping: "scraper.server.stopping",
  },
  web: {
    accountLoaded: "web.account.loaded",
    fxRatesFetchFailed: "web.fxRates.fetch.failed",
    localeSyncFailed: "web.locale.sync.failed",
    userSettingsFetchFailed: "web.userSettings.fetch.failed",
    userSettingsSaveFailed: "web.userSettings.save.failed",
  },
} as const;

export const loggerValues = {
  apps: {
    api: "api",
    ci: "ci",
    scraper: "scraper",
    web: "web",
  },
  logProxy: {
    clientKeyHeader: "x-log-client-key",
    maxBatchSize: 25,
    source: "log-proxy",
  },
} as const;
