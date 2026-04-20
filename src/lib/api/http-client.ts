import axios, { AxiosInstance } from "axios";

interface HttpClientOptions {
  baseURL?: string;
  headers?: Record<string, string>;
}

export function createHttpClient(options: HttpClientOptions = {}): AxiosInstance {
  return axios.create({
    baseURL: options.baseURL,
    timeout: 15_000,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}
