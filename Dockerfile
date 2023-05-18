FROM node:17-alpine

COPY . /usr/src/
WORKDIR /usr/src/

RUN npm i

CMD ["node", "src/index.js"]