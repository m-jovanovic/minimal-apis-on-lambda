import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Custom metrics for detailed tracking
const createDuration = new Trend("create_duration");
const fetchDuration = new Trend("fetch_duration");
const updateDuration = new Trend("update_duration");
const deleteDuration = new Trend("delete_duration");
const crudSuccessRate = new Rate("crud_success_rate");

// Configuration
const BASE_URL =
  "https://localhost:5001"; // Update with your actual API URL
const API_ENDPOINT = `${BASE_URL}/products`;

// Test data - using random data to avoid conflicts
const getRandomProduct = () => ({
  name: `Load Test Product ${Math.random().toString(36).substr(2, 9)}`,
  description: `Load test product ${Math.random().toString(36).substr(2, 9)}`,
  price: Math.round((Math.random() * 1000 + 10) * 100) / 100, // Random price between 10-1010
});

export let options = {
  stages: [
    { duration: "10s", target: 20 }, // Ramp up to 20 VUs over 10s
    { duration: "30s", target: 100 }, // Ramp up to 100 VUs over 30s
    { duration: "20s", target: 100 }, // Stay at 100 VUs for 20s
    { duration: "10s", target: 0 }, // Ramp down to 0 VUs over 10s
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"], // 95% of requests must complete below 5s
    http_req_failed: ["rate<0.05"], // Error rate must be below 5%
    crud_success_rate: ["rate>0.95"], // CRUD success rate must be above 95%
    create_duration: ["p(95)<2000"], // 95% of CREATE operations below 2s
    fetch_duration: ["p(95)<1000"], // 95% of FETCH operations below 1s
    update_duration: ["p(95)<2000"], // 95% of UPDATE operations below 2s
    delete_duration: ["p(95)<1000"], // 95% of DELETE operations below 1s
  },
};

export default function () {
  let productId = null;
  let crudCycleSuccess = false;

  // Generate unique test data for this VU
  const testProduct = getRandomProduct();

  try {
    // 1. CREATE PRODUCT
    const createStart = Date.now();
    const createResponse = http.post(
      API_ENDPOINT,
      JSON.stringify(testProduct),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    const createDurationMs = Date.now() - createStart;
    createDuration.add(createDurationMs);

    const createSuccess = check(createResponse, {
      "CREATE: Status is 201": (r) => r.status === 201,
      "CREATE: Response has product ID": (r) => {
        try {
          const body = JSON.parse(r.body);
          productId = body.id;
          return productId !== undefined;
        } catch (e) {
          return false;
        }
      },
    });

    if (!createSuccess || !productId) {
      crudCycleSuccess = false;
      return;
    }

    sleep(0.1); // Small delay between operations

    // 2. FETCH PRODUCT
    const fetchStart = Date.now();
    const fetchResponse = http.get(`${API_ENDPOINT}/${productId}`);
    const fetchDurationMs = Date.now() - fetchStart;
    fetchDuration.add(fetchDurationMs);

    const fetchSuccess = check(fetchResponse, {
      "FETCH: Status is 200": (r) => r.status === 200,
      "FETCH: Response has correct ID": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id === productId;
        } catch (e) {
          return false;
        }
      },
    });

    if (!fetchSuccess) {
      crudCycleSuccess = false;
      return;
    }

    sleep(0.1);

    // 3. UPDATE PRODUCT
    const updateStart = Date.now();
    const updatedProduct = {
      name: `Updated ${testProduct.name}`,
      description: `Updated ${testProduct.description}`,
      price: testProduct.price + 50,
    };

    const updateResponse = http.put(
      `${API_ENDPOINT}/${productId}`,
      JSON.stringify(updatedProduct),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
    const updateDurationMs = Date.now() - updateStart;
    updateDuration.add(updateDurationMs);

    const updateSuccess = check(updateResponse, {
      "UPDATE: Status is 200": (r) => r.status === 200,
      "UPDATE: Response has correct ID": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id === productId;
        } catch (e) {
          return false;
        }
      },
    });

    if (!updateSuccess) {
      crudCycleSuccess = false;
      return;
    }

    sleep(0.1);

    // 4. DELETE PRODUCT
    const deleteStart = Date.now();
    const deleteResponse = http.del(`${API_ENDPOINT}/${productId}`);
    const deleteDurationMs = Date.now() - deleteStart;
    deleteDuration.add(deleteDurationMs);

    const deleteSuccess = check(deleteResponse, {
      "DELETE: Status is 204": (r) => r.status === 204,
    });

    if (!deleteSuccess) {
      crudCycleSuccess = false;
      return;
    }

    // All operations succeeded
    crudCycleSuccess = true;

    // Log success for this VU (only occasionally to avoid spam)
    if (Math.random() < 0.01) {
      // Log only 1% of successful operations to avoid console spam
      console.log(
        `✅ VU ${__VU}: CRUD cycle completed successfully in ${
          createDurationMs +
          fetchDurationMs +
          updateDurationMs +
          deleteDurationMs
        }ms`
      );
    }
  } catch (error) {
    console.error(
      `❌ VU ${__VU}: Error during CRUD operations: ${error.message}`
    );
    crudCycleSuccess = false;
  } finally {
    // Record the CRUD cycle success rate (only once per iteration)
    crudSuccessRate.add(crudCycleSuccess);
  }

  // Random sleep between 0.5-2 seconds to simulate realistic user behavior
  sleep(Math.random() * 1.5 + 0.5);
}

export function handleSummary(data) {
  // Debug information for custom metrics
  const createCount = data.metrics.create_duration.values.count || 0;
  const fetchCount = data.metrics.fetch_duration.values.count || 0;
  const updateCount = data.metrics.update_duration.values.count || 0;
  const deleteCount = data.metrics.delete_duration.values.count || 0;

  return {
    stdout: `
🚀 Load Test Summary:
==================
Total VUs: ${data.metrics.vus.values.max}
Test Duration: ${data.state.testRunDurationMs / 1000}s
Total Requests: ${data.metrics.http_reqs.values.count}

🔍 Debug Info:
- CREATE operations recorded: ${createCount}
- FETCH operations recorded: ${fetchCount}
- UPDATE operations recorded: ${updateCount}
- DELETE operations recorded: ${deleteCount}

📊 Performance Metrics:
- Average Response Time: ${Math.round(
      data.metrics.http_req_duration.values.avg
    )}ms
- 95th Percentile: ${Math.round(data.metrics.http_req_duration.values.p95)}ms
- 99th Percentile: ${Math.round(data.metrics.http_req_duration.values.p99)}ms

 🎯 CRUD Operation Metrics:
 - CREATE Avg: ${Math.round(
   data.metrics.create_duration.values.avg || 0
 )}ms (P95: ${
      isNaN(data.metrics.create_duration.values.p95)
        ? "N/A"
        : Math.round(data.metrics.create_duration.values.p95) + "ms"
    })
 - FETCH Avg: ${Math.round(
   data.metrics.fetch_duration.values.avg || 0
 )}ms (P95: ${
      isNaN(data.metrics.fetch_duration.values.p95)
        ? "N/A"
        : Math.round(data.metrics.fetch_duration.values.p95) + "ms"
    })
 - UPDATE Avg: ${Math.round(
   data.metrics.update_duration.values.avg || 0
 )}ms (P95: ${
      isNaN(data.metrics.update_duration.values.p95)
        ? "N/A"
        : Math.round(data.metrics.update_duration.values.p95) + "ms"
    })
 - DELETE Avg: ${Math.round(
   data.metrics.delete_duration.values.avg || 0
 )}ms (P95: ${
      isNaN(data.metrics.delete_duration.values.p95)
        ? "N/A"
        : Math.round(data.metrics.delete_duration.values.p95) + "ms"
    })

✅ Success Rates:
- HTTP Success Rate: ${Math.round(
      (1 - data.metrics.http_req_failed.values.rate) * 100
    )}%
- CRUD Success Rate: ${Math.round(
      data.metrics.crud_success_rate.values.rate * 100
    )}%

🔍 Threshold Results:
${
  data.thresholds
    ? Object.entries(data.thresholds)
        .map(
          ([name, result]) => `- ${name}: ${result.ok ? "✅ PASS" : "❌ FAIL"}`
        )
        .join("\n")
    : "No thresholds defined"
}

📈 Request Rate: ${Math.round(
      data.metrics.http_reqs.values.rate
    )} requests/second
    `,
  };
}
