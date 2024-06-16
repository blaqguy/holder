FROM nginx
COPY files/nginx.conf /etc/nginx/nginx.conf

# Forward request logs to Docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
  && ln -sf /dev/stderr /var/log/nginx/error.log

ENTRYPOINT ["nginx", "-g", "daemon off;"]
