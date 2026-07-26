const RESPONSE_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
});

export default {
  fetch(request) {
    if (request.method !== "GET") {
      return new Response(null, {
        status: 405,
        headers: {
          ...RESPONSE_HEADERS,
          Allow: "GET",
        },
      });
    }

    return new Response(
      JSON.stringify({
        configured: false,
        hostedDeviceOnly: true,
      }),
      {
        status: 200,
        headers: RESPONSE_HEADERS,
      },
    );
  },
};
