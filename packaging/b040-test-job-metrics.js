#! /usr/bin/env node

(async () => {
  const axios = require("axios");
  const sleepAsync = require("sleep-promise");
  let lastProcessedMetric = 0;

  for (let i = 0; i < 5; ++i) {
    const resp = await axios.get("http://localhost:19982/api/metrics/basic");
    const processedMetric = resp.data.processed;

    console.log(`- ${i}: ${processedMetric} processed`);

    if (processedMetric <= lastProcessedMetric) {
      console.error("!!! processed metric did not increase over tick.");
      process.exit(1);
    }

    lastProcessedMetric = processedMetric;
    await sleepAsync(1000);
  }

  process.exit(0);
})();
