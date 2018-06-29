/**
 * Абстрактный компонент с индикатором прогресса
 *
 * @module Progress
 *
 * Created by Evgeniy Malyarov on 24.03.2018.
 */

import React, {Component} from 'react';
import PropTypes from 'prop-types';
import LinearProgress from '@material-ui/core/LinearProgress';

class Progress extends Component {

  constructor(props, context) {
    super(props, context);
    this.state = {
      error: '',
      step: 'Подготовка данных...',
      docs: null,
      prods: null,
      completed: 0,
      buffer: 10,
    };
    this.timer = 0;
  }

  componentDidMount() {

    const {local, remote, authorized} = $p.adapters.pouch;

    if(local.doc === remote.doc) {
      this.setState({error: `В режиме 'direct', синхронизация заказов не требуется`});
      return;
    }

    if(!authorized) {
      this.setState({error: `Пользователь должен быть авторизован на сервере`});
      return;
    }

    this.timer = setInterval(this.progress, 700);

    this.init && this.init();

  }

  componentWillUnmount() {
    this.timer && clearInterval(this.timer);
  }

  /**
   * Синхронизирует массив заказов
   * @param refs
   */
  sync_orders(docs, keys) {

    const {local, remote} = $p.adapters.pouch;

    this.setState({step: 'Сравниваем версии заказов local и remote...', completed: 0, buffer: 10});

    return remote.doc.allDocs({keys})
      .then(({rows}) => {
        const diff = [];
        for(const rdoc of rows) {
          if(rdoc.value){
            if(!docs.some((doc) => {
                return doc.key && doc.value ?
                  doc.id === rdoc.id && doc.value.rev === rdoc.value.rev : doc._id === rdoc.id && doc._rev === rdoc.value.rev;
              })) {
              diff.push(rdoc.id);
            }
          }
          else {
            // TODO: обработать пометку удаления
          }
        }
        return {ldoc: keys, diff};
      })
      .then(({ldoc, diff}) => {
        if(diff.length) {
          this.setState({step: 'Получаем объекты заказов с сервера...', completed: 0, buffer: 10});
          return remote.doc.allDocs({include_docs: true, attachments: true, keys: diff})
            .then(({rows}) => {
              this.setState({step: 'Записываем изменённые заказы...'});
              return local.doc.bulkDocs(rows.filter((v) => v.doc).map(({doc}) => doc), {new_edits: false});
            })
            .then(() => {
              this.setState({step: 'Получаем объекты заказов из базы браузера...', completed: 0, buffer: 10});
              return local.doc.allDocs({include_docs: true, keys: ldoc});
            });
        }
        else {
          this.setState({step: 'Получаем объекты заказов из базы браузера...', completed: 0, buffer: 10});
          return local.doc.allDocs({include_docs: true, keys: ldoc});
        }
      });
  }

  /**
   * Синхронизирует продукции
   * @param refs
   */
  sync_products(docs) {

    const {local, remote} = $p.adapters.pouch;

    const keys = [];
    for (const {production} of docs) {
      if(production) {
        for (const row of production) {
          if(row.characteristic && row.characteristic !== $p.utils.blank.guid) {
            keys.push(`cat.characteristics|${row.characteristic}`);
          }
        }
      }
    }
    this.setState({step: 'Сравниваем версии характеристик продукций...', completed: 0, buffer: 10});

    return Promise.all([
      local.doc.allDocs({keys}),
      remote.doc.allDocs({keys}),
    ])
      .then((res) => {
        const ldoc = res[0].rows;
        const diff = [];
        for(const rdoc of res[1].rows) {
          if(!rdoc.value) {
            // TODO: обработать удаление
            continue;
          }
          if(!ldoc.some((doc) => {
              return !doc.error && doc.id === rdoc.id && doc.value.rev === rdoc.value.rev;
            })) {
            diff.push(rdoc.id);
          }
        }
        // формируем массив пачек по 100 элементов
        const difs = {
          length: diff.length,
          rows: []
        };
        this.setState({step: `Найдено ${difs.length} отличий в характеристиках`, completed: 0, buffer: 10});
        let rows = [];
        for(const dif of diff) {
          if(rows.length < 100) {
            rows.push(dif);
          }
          else {
            difs.rows.push(rows);
            rows = [dif];
          }
        }
        if(rows.length) {
          difs.rows.push(rows);
        }
        return difs;
      })
      .then((difs) => {
        // редуцируем
        return difs.rows.reduce((sum, keys, index) => {
          return sum.then(() => {
            this.setState({step: `Обработано ${index * 100} из ${difs.length} характеристик продукций`});
            return remote.doc.allDocs({include_docs: true, keys})
              .then(({rows}) => {
                // const deleted = rows.filter((v) => !v.doc);
                return local.doc.bulkDocs(rows.filter((v) => v.doc && !v.doc._attachments).map((v) => v.doc), {new_edits: false});
              });
          });
        }, Promise.resolve());
      });
  }

  /**
   * Перестраивает индексы
   */
  rebuild_indexes() {

    this.setState({step: `Перестраиваем индексы...`, completed: 0, buffer: 10});
    $p.adapters.pouch.on('rebuild_indexes', this.on_index);

    return $p.adapters.pouch.rebuild_indexes('doc')
      .then(() => {
        $p.adapters.pouch.off('rebuild_indexes', this.on_index);
        if(this.timer) {
          clearInterval(this.timer);
          this.timer = 0;
        }
        this.setState({error: 'Обработка завершена'});
        setTimeout(() => {
          this.props.handleCancel();
        }, 2000);
      });

  }

  on_index = (info) => {
    this.setState({step: `Перестраиваем индекс ${info.index}...`});
  }

  progress = () => {
    const { completed } = this.state;
    if (completed > 100) {
      this.setState({ completed: 0, buffer: 10 });
    } else {
      const diff = Math.random() * 5;
      const diff2 = Math.random() * 5;
      this.setState({ completed: completed + diff, buffer: completed + diff + diff2 });
    }
  };

  render() {
    const {error, step, completed, buffer} = this.state;

    if(error) {
      return <div>{error}</div>;
    }

    return [
      <div key="progress" style={{flexGrow: 1}}>
        <LinearProgress color="secondary" variant="buffer" value={completed} valueBuffer={buffer} />
        <br />
      </div>,
      <div key="text">{step}</div>
    ];
  }
}

Progress.propTypes = {
  handleCancel: PropTypes.func.isRequired,
};

export default Progress;
