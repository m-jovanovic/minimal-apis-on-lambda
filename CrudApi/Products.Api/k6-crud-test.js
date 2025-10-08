import http from "k6/http";
import { check, sleep } from "k6";

// Configuration
const BASE_URL =
  "https://localhost:5001"; // Update with your actual API URL
const API_ENDPOINT = `${BASE_URL}/products`;

// Test data
const testProduct = {
  name: "Test Product",
  description: "A test product for k6 performance testing",
  price: 99.99,
};

export let options = {
  vus: 1, // 1 virtual user
  iterations: 1, // Run once
  thresholds: {
    http_req_duration: ["p(95)<2000"], // 95% of requests must complete below 2s
    http_req_failed: ["rate<0.1"], // Error rate must be below 10%
  },
};

export default function () {
  let productId = null;

  console.log("🚀 Starting CRUD operations test...");

  // 1. CREATE PRODUCT
  console.log("📝 Step 1: Creating product...");
  const createStart = Date.now();

  const createResponse = http.post(API_ENDPOINT, JSON.stringify(testProduct), {
    headers: { "Content-Type": "application/json" },
  });

  const createDuration = Date.now() - createStart;

  const createSuccess = check(createResponse, {
    "CREATE: Status is 201": (r) => r.status === 201,
    "CREATE: Response has product ID": (r) => {
      const body = JSON.parse(r.body);
      productId = body.id;
      return productId !== undefined;
    },
    "CREATE: Response has correct name": (r) => {
      const body = JSON.parse(r.body);
      return body.name === testProduct.name;
    },
    "CREATE: Response has correct price": (r) => {
      const body = JSON.parse(r.body);
      return body.price === testProduct.price;
    },
  });

  console.log(
    `✅ CREATE completed in ${createDuration}ms - Success: ${createSuccess}`
  );

  if (!createSuccess || !productId) {
    console.error("❌ CREATE operation failed, stopping test");
    return;
  }

  sleep(0.1); // Small delay between operations

  // 2. FETCH PRODUCT
  console.log("🔍 Step 2: Fetching product...");
  const fetchStart = Date.now();

  const fetchResponse = http.get(`${API_ENDPOINT}/${productId}`);

  const fetchDuration = Date.now() - fetchStart;

  const fetchSuccess = check(fetchResponse, {
    "FETCH: Status is 200": (r) => r.status === 200,
    "FETCH: Response has correct ID": (r) => {
      const body = JSON.parse(r.body);
      return body.id === productId;
    },
    "FETCH: Response has correct name": (r) => {
      const body = JSON.parse(r.body);
      return body.name === testProduct.name;
    },
    "FETCH: Response has correct price": (r) => {
      const body = JSON.parse(r.body);
      return body.price === testProduct.price;
    },
  });

  console.log(
    `✅ FETCH completed in ${fetchDuration}ms - Success: ${fetchSuccess}`
  );

  if (!fetchSuccess) {
    console.error("❌ FETCH operation failed");
  }

  sleep(0.1);

  // 3. UPDATE PRODUCT
  console.log("✏️ Step 3: Updating product...");
  const updateStart = Date.now();

  const updatedProduct = {
    name: "Updated Test Product",
    description: "An updated test product for k6 performance testing",
    price: 149.99,
  };

  const updateResponse = http.put(
    `${API_ENDPOINT}/${productId}`,
    JSON.stringify(updatedProduct),
    {
      headers: { "Content-Type": "application/json" },
    }
  );

  const updateDuration = Date.now() - updateStart;

  const updateSuccess = check(updateResponse, {
    "UPDATE: Status is 200": (r) => r.status === 200,
    "UPDATE: Response has correct ID": (r) => {
      const body = JSON.parse(r.body);
      return body.id === productId;
    },
    "UPDATE: Response has updated name": (r) => {
      const body = JSON.parse(r.body);
      return body.name === updatedProduct.name;
    },
    "UPDATE: Response has updated price": (r) => {
      const body = JSON.parse(r.body);
      return body.price === updatedProduct.price;
    },
  });

  console.log(
    `✅ UPDATE completed in ${updateDuration}ms - Success: ${updateSuccess}`
  );

  if (!updateSuccess) {
    console.error("❌ UPDATE operation failed");
  }

  sleep(0.1);

  // 4. DELETE PRODUCT
  console.log("🗑️ Step 4: Deleting product...");
  const deleteStart = Date.now();

  const deleteResponse = http.del(`${API_ENDPOINT}/${productId}`);

  const deleteDuration = Date.now() - deleteStart;

  const deleteSuccess = check(deleteResponse, {
    "DELETE: Status is 204": (r) => r.status === 204,
  });

  console.log(
    `✅ DELETE completed in ${deleteDuration}ms - Success: ${deleteSuccess}`
  );

  if (!deleteSuccess) {
    console.error("❌ DELETE operation failed");
  }

  // Summary
  console.log("\n📊 CRUD Operations Summary:");
  console.log(`CREATE: ${createDuration}ms - ${createSuccess ? "✅" : "❌"}`);
  console.log(`FETCH:  ${fetchDuration}ms - ${fetchSuccess ? "✅" : "❌"}`);
  console.log(`UPDATE: ${updateDuration}ms - ${updateSuccess ? "✅" : "❌"}`);
  console.log(`DELETE: ${deleteDuration}ms - ${deleteSuccess ? "✅" : "❌"}`);

  const totalDuration =
    createDuration + fetchDuration + updateDuration + deleteDuration;
  const allSuccess =
    createSuccess && fetchSuccess && updateSuccess && deleteSuccess;

  console.log(`\n🎯 Total Duration: ${totalDuration}ms`);
  console.log(`🎯 All Operations Success: ${allSuccess ? "✅" : "❌"}`);

  sleep(1);
}
