FROM node:14

COPY . /usr/src/
WORKDIR /usr/src/

RUN npm i

CMD ["node", "src/index.js"]